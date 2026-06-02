from fastapi import FastAPI, HTTPException, Depends, Header
from pydantic import BaseModel, EmailStr , Field
import spacy
from spacy.matcher import PhraseMatcher
from fastapi.middleware.cors import CORSMiddleware
import torch
from transformers import BertTokenizer, BertForSequenceClassification
import os
import json
import re
from bson import ObjectId
import fitz  # PyMuPDF
from PIL import Image
import io
from appwrite.client import Client
from appwrite.services.storage import Storage
from motor.motor_asyncio import AsyncIOMotorClient
import bcrypt as bcrypt_lib
import jwt
from datetime import datetime, timedelta
from dotenv import load_dotenv
from typing import Optional, List, Literal
from datetime import datetime

load_dotenv()

# --- Configuration & Environment ---
MONGO_URI = os.getenv("MONGO_URI")
JWT_SECRET = os.getenv("JWT_SECRET", "secret")
ALGORITHM = "HS256"

# --- MongoDB Setup ---
client_db = AsyncIOMotorClient(MONGO_URI)
db = client_db.get_database("test") # Assuming "test" or change to your DB name
users_collection = db.get_collection("UserMR")
doctors_collection = db.get_collection("doctors")
hospitals_collection = db["hospitals"]
hospital_wards_collection = db["hospital_wards"]
bed_bookings_collection = db["bed_bookings"]


# Indexes — run once
# hospitals_collection.create_index("geoapifyPlaceId", unique=True)
# hospitals_collection.create_index("isPartner")

# hospital_wards_collection.create_index("hospitalId")
# hospital_wards_collection.create_index([("hospitalId", 1), ("wardType", 1)], unique=True)

# bed_bookings_collection.create_index("patientId")
# bed_bookings_collection.create_index("hospitalId")
# bed_bookings_collection.create_index("status")
# bed_bookings_collection.create_index("holdExpiresAt")  # for expiry cron

# --- Security ---
def hash_password(password: str) -> str:
    return bcrypt_lib.hashpw(password.encode("utf-8"), bcrypt_lib.gensalt()).decode("utf-8")

def verify_password(plain_password: str, hashed_password: str) -> bool:
    try:
        return bcrypt_lib.checkpw(plain_password.encode("utf-8"), hashed_password.encode("utf-8"))
    except Exception:
        return False

def create_access_token(data: dict):
    to_encode = data.copy()
    expire = datetime.utcnow() + timedelta(days=2)
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, JWT_SECRET, algorithm=ALGORITHM)


# --- Condition Metadata ---
CONDITION_METADATA = {
    "Anemia": {
        "description": "Anemia is a condition where your blood has a lower than normal amount of healthy red blood cells or hemoglobin.",
        "how_it_happens": "It happens when the body doesn't produce enough red blood cells, breaks them down too quickly, or red blood cells are lost through bleeding. This reduces oxygen delivery to tissues.",
        "advice": "Eat iron-rich foods like spinach and red meat. Avoid excessive tea or coffee with meals as they block iron absorption.",
        "specialist": "General"
    },
    "Atrial fibrillation": {
        "description": "An irregular and often very rapid heart rhythm that can lead to blood clots in the heart.",
        "how_it_happens": "The heart's upper chambers (atria) beat chaotically and irregularly, out of sync with the lower chambers (ventricles).",
        "advice": "Limit caffeine and alcohol. Avoid intense stimulants. Monitor heart rate regularly.",
        "specialist": "Cardiology"
    },
    "Panic attack": {
        "description": "A sudden episode of intense fear that triggers severe physical reactions when there is no real danger.",
        "how_it_happens": "The body's 'fight-or-flight' response is activated inappropriately, causing a surge in adrenaline and stress hormones.",
        "advice": "Practice deep breathing (4-7-8 technique). Avoid caffeine and nicotine during episodes. Remind yourself it will pass.",
        "specialist": "General"
    },
    "Cluster headache": {
        "description": "Extremely painful headaches that occur in cyclical patterns or clusters.",
        "how_it_happens": "Often related to abnormalities in the body's biological clock (hypothalamus), causing sudden activation of the trigeminal nerve.",
        "advice": "Avoid alcohol and cigarette smoke during a cluster period. Maintain a consistent sleep schedule.",
        "specialist": "Neurology"
    },
    "GERD": {
        "description": "Gastroesophageal reflux disease, where stomach acid frequently flows back into the tube connecting your mouth and stomach.",
        "how_it_happens": "The lower esophageal sphincter (LES) weakens or relaxes when it shouldn't, allowing acid to leak upwards.",
        "advice": "Avoid lying down after meals. Limit spicy, acidic, and fatty foods. Eat smaller portions.",
        "specialist": "General"
    },
    "Pneumonia": {
        "description": "An infection that inflames the air sacs in one or both lungs, which may fill with fluid or pus.",
        "how_it_happens": "Pathogens like bacteria, viruses, or fungi enter the lungs, causing an inflammatory response and fluid buildup in the alveoli.",
        "advice": "Stay hydrated, rest, and follow your antibiotic/antiviral course strictly. Avoid smoking and second-hand smoke.",
        "specialist": "General"
    },
    "Bronchitis": {
        "description": "Inflammation of the lining of your bronchial tubes, which carry air to and from your lungs.",
        "how_it_happens": "Usually caused by a viral infection (like the cold or flu), leading to swelling and mucus production in the airways.",
        "advice": "Use a humidifier and drink plenty of fluids to thin mucus. Avoid irritants like smoke and pollution.",
        "specialist": "General"
    },
    "Influenza": {
        "description": "A common viral infection that can be deadly, especially in high-risk groups.",
        "how_it_happens": "The influenza virus attacks the respiratory system, leading to systemic symptoms like high fever and muscle aches.",
        "advice": "Rest and isolate to prevent spread. Drink plenty of fluids. Consult a doctor for antivirals if caught early.",
        "specialist": "General"
    },
    "Tuberculosis": {
        "description": "A serious infectious bacterial disease that mainly affects the lungs.",
        "how_it_happens": "Mycobacterium tuberculosis bacteria are inhaled and can create infectious colonies in the lung tissue.",
        "advice": "Strict adherence to the long-term medication course is vital. Wear a mask in public while infectious.",
        "specialist": "Emergency"
    },
    "Pulmonary embolism": {
        "description": "A condition in which one or more arteries in the lungs become blocked by a blood clot.",
        "how_it_happens": "Most often, a blood clot from the leg (DVT) travels to the lungs and lodges in a pulmonary artery.",
        "advice": "This is a medical emergency. Avoid sitting for long periods. Follow anticoagulant therapy if prescribed.",
        "specialist": "Emergency"
    },
    "Spontaneous pneumothorax": {
        "description": "A collapsed lung that occurs without an apparent cause.",
        "how_it_happens": "Air leaks into the space between your lung and chest wall (pleura), creating pressure that makes the lung collapse.",
        "advice": "Seek emergency care if you have sudden chest pain or shortness of breath. Avoid high altitudes and scuba diving until cleared.",
        "specialist": "Emergency"
    },
    "Viral pharyngitis": {
        "description": "Inflammation of the throat (pharynx) caused by a viral infection.",
        "how_it_happens": "Viruses like the common cold or flu infect the throat tissue, causing swelling and pain.",
        "advice": "Gargle with warm salt water. Drink warm liquids and use throat lozenges. Antibiotics will not help a viral infection.",
        "specialist": "General"
    },
    "Anaphylaxis": {
        "description": "A severe, potentially life-threatening allergic reaction.",
        "how_it_happens": "The immune system releases a flood of chemicals that can cause the body to go into shock, airways to narrow, and blood pressure to drop.",
        "advice": "Use an epinephrine auto-injector (EpiPen) immediately and call emergency services. Always carry your allergy medication.",
        "specialist": "Emergency"
    },
    "Epiglottitis": {
        "description": "A life-threatening condition that occurs when the tissue protecting the windpipe becomes inflamed.",
        "how_it_happens": "Usually caused by a bacterial infection, it can block the flow of air into your lungs.",
        "advice": "This is a medical emergency. Do not attempt to look down the throat with a spoon or tongue depressor as it can trigger a complete airway blockage.",
        "specialist": "Emergency"
    },
    "Stable angina": {
        "description": "Chest pain or discomfort that most often occurs with activity or emotional stress.",
        "how_it_happens": "The heart muscle doesn't get enough oxygen-rich blood because of narrowed coronary arteries.",
        "advice": "Rest usually relieves the pain. Avoid intense physical exertion and heavy meals. Follow your prescribed heart medication schedule.",
        "specialist": "Cardiology"
    },
    "Ebola": {
        "description": "A rare but deadly virus that causes fever, body aches, and diarrhea, and sometimes, bleeding.",
        "how_it_happens": "The virus attacks cells in the immune system and liver, leading to systemic inflammation and organ failure.",
        "advice": "This is a severe medical emergency requiring immediate isolation. Avoid contact with the blood or body fluids of people who are sick.",
        "specialist": "Emergency"
    },
    "Acute otitis media": {
        "description": "A type of ear infection that is very common in children.",
        "how_it_happens": "Fluid buildup behind the eardrum, often due to a viral or bacterial infection of the Eustachian tube.",
        "advice": "Use warm compresses for pain relief. Avoid getting water in the ear. Complete any antibiotic course if prescribed.",
        "specialist": "General"
    },
    "Bronchospasm / acute asthma exacerbation": {
        "description": "A sudden constriction of the muscles in the walls of the bronchioles.",
        "how_it_happens": "Triggers like allergens or exercise cause the muscles around the airways to tighten, making it difficult to breathe.",
        "advice": "Use your rescue inhaler immediately. Stay calm and breathe slowly. If symptoms don't improve, seek emergency care.",
        "specialist": "General"
    },
    "Acute COPD exacerbation / infection": {
        "description": "A sudden worsening of COPD symptoms that is typically caused by an infection.",
        "how_it_happens": "Inflammation in the already damaged lungs increases, leading to more mucus production and airway narrowing.",
        "advice": "Use your prescribed oxygen or nebulizer. Avoid smoke and cold air. Seek immediate help if you have difficulty speaking due to breathlessness.",
        "specialist": "General"
    },
    "Chagas": {
        "description": "An infectious disease caused by a parasite found in the feces of the triatomine bug.",
        "how_it_happens": "The parasite Trypanosoma cruzi is transmitted to humans through contact with bug feces or contaminated food, potentially leading to heart or digestive issues over time.",
        "advice": "Seek specialized treatment immediately if you suspect infection. Use insect repellent and bed nets in high-risk areas.",
        "specialist": "Emergency"
    },
    "Scombroid food poisoning": {
        "description": "A type of food poisoning caused by eating spoiled fish.",
        "how_it_happens": "Bacteria in certain fish produce high levels of histamine when the fish isn't kept cold enough.",
        "advice": "Symptoms usually pass within 24 hours. Antihistamines may help, but seek medical care if symptoms are severe or don't improve.",
        "specialist": "Emergency"
    },
    "Myocarditis": {
        "description": "Inflammation of the middle layer of the heart wall.",
        "how_it_happens": "Usually caused by a viral infection, the heart's muscle becomes inflamed and weakened, reducing its ability to pump blood.",
        "advice": "Rest is essential to allow the heart to recover. Avoid strenuous activity until cleared by a cardiologist. Follow all prescribed medications.",
        "specialist": "Cardiology"
    },
    "Larygospasm": {
        "description": "A brief spasm of the vocal cords that temporarily makes it difficult to speak or breathe.",
        "how_it_happens": "The vocal cords suddenly seize up, often in response to acid reflux, a foreign object, or an irritant.",
        "advice": "Try to stay calm and take slow, shallow breaths. If it happens frequently, consult an ENT specialist to check for underlying causes like GERD.",
        "specialist": "Emergency"
    },
    "Localized edema": {
        "description": "Swelling in a specific part of the body caused by excess fluid trapped in your tissues.",
        "how_it_happens": "Often caused by injury, inflammation, or problems with local blood or lymph vessels, causing fluid to leak into surrounding tissue.",
        "advice": "Elevate the affected limb. Wear compression stockings if recommended. Avoid high salt intake. Seek care if the swelling is sudden or painful.",
        "specialist": "General"
    },
    "SLE": {
        "description": "Systemic lupus erythematosus, an autoimmune disease in which the immune system attacks its own tissues.",
        "how_it_happens": "The immune system becomes hyperactive and creates antibodies that attack healthy tissue, causing widespread inflammation and tissue damage.",
        "advice": "Manage stress and get plenty of rest. Use sun protection as UV light can trigger flares. Follow your immunosuppressant or anti-inflammatory regimen closely.",
        "specialist": "General"
    },
    "Acute dystonic reactions": {
        "description": "Involuntary muscle contractions that cause repetitive or twisting movements.",
        "how_it_happens": "Often a side effect of certain medications, where the balance of dopamine in the brain is disrupted.",
        "advice": "This is a medical emergency. Seek immediate care as medications like diphenhydramine can often reverse the reaction quickly.",
        "specialist": "Emergency"
    },
    "Boerhaave": {
        "description": "A spontaneous rupture of the esophagus wall.",
        "how_it_happens": "Usually caused by forceful vomiting or retching, leading to a tear that allows stomach contents to leak into the chest cavity.",
        "advice": "This is a critical medical emergency. Do not eat or drink anything and seek immediate surgical intervention.",
        "specialist": "Emergency"
    },
    "Spontaneous rib fracture": {
        "description": "A break in a rib bone that occurs without any significant trauma.",
        "how_it_happens": "Often due to underlying bone weakening (osteoporosis) or intense repetitive stress (like chronic coughing).",
        "advice": "Rest and avoid activities that strain the chest. Use pain relief as directed. Consult a doctor to check for underlying bone density issues.",
        "specialist": "General"
    },
    "HIV (initial infection)": {
        "description": "The early stage of Human Immunodeficiency Virus infection.",
        "how_it_happens": "The virus rapidly replicates in the blood and immune system, often causing flu-like symptoms as the body tries to fight back.",
        "advice": "Early diagnosis and treatment (ART) are vital for long-term health. Use protection and inform partners. Consult a specialist immediately.",
        "specialist": "Specialist"
    },
    "Myasthenia gravis": {
        "description": "A chronic autoimmune, neuromuscular disease that causes weakness in the skeletal muscles.",
        "how_it_happens": "Antibodies block, alter, or destroy the receptors for acetylcholine at the neuromuscular junction, preventing muscle contraction.",
        "advice": "Rest can help improve muscle weakness. Avoid fatigue and extreme heat. Maintain a regular medication schedule as prescribed by your neurologist.",
        "specialist": "Neurology"
    },
    "Whooping cough": {
        "description": "A highly contagious respiratory tract infection characterized by a severe hacking cough followed by a high-pitched intake of breath.",
        "how_it_happens": "Bordetella pertussis bacteria attach to the cilia in the upper respiratory system and release toxins that cause airway swelling.",
        "advice": "Stay hydrated and use a humidifier. Complete the full course of antibiotics to prevent spread. Ensure your Tdap vaccinations are up to date.",
        "specialist": "General"
    },
    "Allergic sinusitis": {
        "description": "Inflammation of the sinuses caused by an allergic reaction.",
        "how_it_happens": "The immune system overreacts to allergens like pollen or dust, causing the sinus linings to swell and trap mucus.",
        "advice": "Avoid known allergens. Use saline nasal rinses and antihistamines. Consult an allergist for long-term management.",
        "specialist": "General"
    },
    "Acute laryngitis": {
        "description": "Inflammation of the voice box (larynx) from overuse, irritation, or infection.",
        "how_it_happens": "The vocal cords become inflamed or infected, distorting the sounds produced by air passing over them.",
        "advice": "Rest your voice completely. Drink plenty of fluids and use a humidifier. Avoid whispering, as it actually strains the vocal cords more than low-volume talking.",
        "specialist": "General"
    },
    "Croup": {
        "description": "An upper airway infection that blocks breathing and has a distinctive barking cough.",
        "how_it_happens": "Usually a viral infection in young children that causes swelling around the vocal cords (larynx) and windpipe (trachea).",
        "advice": "Keep the child calm, as crying makes breathing harder. Cool night air or a steamy bathroom may help ease breathing. Seek care if there is a high-pitched noise (stridor) while resting.",
        "specialist": "General"
    },
    "Alopecia areata": {
        "description": "A condition that causes hair to fall out in small patches, which can be unnoticeable.",
        "how_it_happens": "An autoimmune disorder where the immune system attacks hair follicles, leading to hair loss on the scalp and elsewhere.",
        "advice": "Consult a dermatologist for treatment options like corticosteroid injections. Reduce stress and maintain a healthy diet.",
        "specialist": "Dermatology"
    }
}

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

@app.on_event("startup")
async def create_indexes():
    await hospitals_collection.create_index("geoapifyPlaceId", unique=True)
    await hospitals_collection.create_index("isPartner")
    await hospital_wards_collection.create_index("hospitalId")
    await hospital_wards_collection.create_index([("hospitalId", 1), ("wardType", 1)], unique=True)
    await bed_bookings_collection.create_index("patientId")
    await bed_bookings_collection.create_index("hospitalId")
    await bed_bookings_collection.create_index("status")
    await bed_bookings_collection.create_index("holdExpiresAt")

@app.get("/api/health")
async def health_check():
    return {"status": "ok", "message": "MediRaksha Backend is healthy"}

# --- Appwrite Configuration ---
APPWRITE_ENDPOINT = 'https://fra.cloud.appwrite.io/v1'
APPWRITE_PROJECT_ID = '695a04f1002eca51706d'
REPORTS_BUCKET_ID = '69610aaa0032a0d29596'

appwrite_client = Client()
appwrite_client.set_endpoint(APPWRITE_ENDPOINT)
appwrite_client.set_project(APPWRITE_PROJECT_ID)
storage_service = Storage(appwrite_client)

# --- BERT Model Integration ---
MODEL_PATH = "ddxplus-bert-model"
def get_labels():
    conditions_path = os.path.join("Data", "Raw", "DDXPlus_English", "release_conditions.json")
    if os.path.exists(conditions_path):
        with open(conditions_path, "r", encoding="utf-8") as f:
            conditions = json.load(f)
            return sorted(list(conditions.keys()))
    return []

LABELS = get_labels()

model, tokenizer = None, None

def ensure_bert_loaded():
    """
    Lazy-load BERT so the API can start without ML assets.
    Only /api/ai-diagnosis uses it (with a keyword-based fallback).
    """
    global model, tokenizer
    if model is not None and tokenizer is not None:
        return

    if os.getenv("DISABLE_BERT", "").strip() in {"1", "true", "TRUE", "yes", "YES"}:
        return

    try:
        tokenizer = BertTokenizer.from_pretrained(MODEL_PATH)
        model = BertForSequenceClassification.from_pretrained(MODEL_PATH)
        model.eval()
        print("✅ BERT Model loaded successfully")
    except Exception as e:
        # Keep backend running; just disable ML fallback.
        print(f"❌ Error loading BERT model: {e}")
        model, tokenizer = None, None

# --- SpaCy Symptom Recognition ---
nlp = None
matcher = None
symptom_list = [
    "fever", "cough", "headache", "fatigue", "nausea",
    "shortness of breath", "chest pain", "dizziness", "sore throat",
    "diabetes", "hypertension", "asthma", "allergy"
]

try:
    nlp = spacy.load("en_core_web_sm")
    matcher = PhraseMatcher(nlp.vocab, attr="LOWER")
    patterns = [nlp.make_doc(symptom) for symptom in symptom_list]
    matcher.add("SYMPTOMS", patterns)
except Exception as e:
    # Keep backend running even if SpaCy model isn't installed.
    # We'll fall back to a simple keyword matcher in extract_symptoms().
    print(f"[WARN] SpaCy model unavailable (symptom recognition will be basic): {e}")
    nlp = None
    matcher = None

class LoginRequest(BaseModel):
    email: str
    password: str

class SignupRequest(BaseModel):
    name: str = None
    email: str
    password: str
    age: int = None
    gender: str = None
    phoneNumber: str = None

class DoctorLoginRequest(BaseModel):
    doctorId: str
    password: str

class DoctorSignupRequest(BaseModel):
    doctorId: str
    password: str

class SymptomRequest(BaseModel):
    text: str

class ReportAnalysisRequest(BaseModel):
    fileId: str

class SymptomResponse(BaseModel):
    symptoms: list[str]

class DiagnosisResponse(BaseModel):
    diagnosis: str
    description: str
    how_it_happens: str
    advice: str
    specialist: str
    confidence: float

class AssistantRequest(BaseModel):
    text: str

class AssistantResponse(BaseModel):
    reply: str

class ReportAnalysisResponse(BaseModel):
    history: str
    mandatory_care: list[str]
    detected_symptoms: list[str]


# ──────────────────────────────────────────────
# HOSPITALS
# ──────────────────────────────────────────────

class Hospital(BaseModel):
    name: str
    geoapifyPlaceId: str                   # from Geoapify Hospital.id
    address: str
    latitude: float
    longitude: float
    phone: Optional[str] = None
    amenities: List[str] = []              # ["icu", "emergency", "pharmacy", ...]
    isPartner: bool = False
    lastInventoryUpdate: Optional[datetime] = None
    updatedBy: Optional[str] = "admin"

# ──────────────────────────────────────────────
# HOSPITAL WARDS
# ──────────────────────────────────────────────

WardType = Literal["general", "icu", "emergency", "pediatric", "maternity"]

class HospitalWard(BaseModel):
    hospitalId: str                        # hospitals._id as string
    wardType: WardType
    label: str                             # "General Ward", "ICU", etc.
    totalBeds: int
    occupiedBeds: int = 0
    reservedBeds: int = 0                  # pending bookings (temporary hold)
    maintenanceBeds: int = 0

    @property
    def availableBeds(self) -> int:
        return self.totalBeds - self.occupiedBeds - self.reservedBeds - self.maintenanceBeds

# ──────────────────────────────────────────────
# BED BOOKINGS
# ──────────────────────────────────────────────

BookingStatus = Literal["pending", "confirmed", "cancelled", "expired", "checked_in"]

class BedBookingCreate(BaseModel):
    hospitalId: str
    wardId: str
    patientName: str
    patientContact: str
    reason: str
    expectedArrival: Optional[datetime] = None

class BedBooking(BedBookingCreate):
    patientId: str
    status: BookingStatus = "pending"
    holdExpiresAt: datetime                # now + 15 minutes
    createdAt: datetime

# --- JWT Auth Dependency ---
async def get_current_user_id(authorization: str = Header(None)):
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(status_code=401, detail="No token provided")
    token = authorization.split(" ")[1]
    try:
        payload = jwt.decode(token, JWT_SECRET, algorithms=[ALGORITHM])
        return payload.get("id"), payload.get("role", "Patient")
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired")
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid token")

# --- Auth Routes (Patient) ---
@app.post("/api/auth/")
async def signup_patient(request: SignupRequest):
    try:
        existing_user = await users_collection.find_one({"email": request.email})
        if existing_user:
            raise HTTPException(status_code=400, detail="User already exists")
        
        user_data = request.dict()
        user_data["password"] = hash_password(request.password)
        
        result = await users_collection.insert_one(user_data)
        token = create_access_token({"id": str(result.inserted_id), "role": "Patient"})
        
        return {"msg": token, "user": {"id": str(result.inserted_id), "role": "Patient", "email": request.email}}
    except Exception as e:
        import traceback
        error_msg = traceback.format_exc()
        print(f"Signup Error: {error_msg}")
        raise HTTPException(status_code=500, detail=error_msg)


@app.get("/api/auth/profile")
async def get_auth_profile(auth=Depends(get_current_user_id)):
    user_id, role = auth
    try:
        if role == "Doctor":
            user = await doctors_collection.find_one({"_id": ObjectId(user_id)})
        else:
            user = await users_collection.find_one({"_id": ObjectId(user_id)})

        if not user:
            raise HTTPException(status_code=404, detail="User not found")

        user["_id"] = str(user["_id"])
        user.pop("password", None)
        user["role"] = role
        return user
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/api/home/")
async def get_patient_home(auth=Depends(get_current_user_id)):
    user_id, role = auth
    if role != "Patient":
        raise HTTPException(status_code=403, detail="Not authorized")
    user = await users_collection.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user["_id"] = str(user["_id"])
    user.pop("password", None)
    user["role"] = role
    return user


@app.post("/api/auth/login")
async def login_patient(request: LoginRequest):
    user = await users_collection.find_one({"email": request.email})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    if not verify_password(request.password, user["password"]):
        raise HTTPException(status_code=400, detail="Invalid password")
    
    token = create_access_token({"id": str(user["_id"]), "role": "Patient"})
    return {"token": token, "user": {"id": str(user["_id"]), "role": "Patient", "email": user["email"]}}

# --- Auth Routes (Doctor) ---
@app.post("/api/auth/doctor/")
async def signup_doctor(request: DoctorSignupRequest):
    existing_doctor = await doctors_collection.find_one({"doctorId": request.doctorId})
    if existing_doctor:
        raise HTTPException(status_code=400, detail="Doctor already exists")
    
    doctor_data = request.dict()
    doctor_data["password"] = hash_password(request.password)
    doctor_data["role"] = "Doctor"
    
    result = await doctors_collection.insert_one(doctor_data)
    token = create_access_token({"id": str(result.inserted_id), "role": "Doctor"})
    
    return {"msg": token, "user": {"id": str(result.inserted_id), "role": "Doctor", "doctorId": request.doctorId}}

@app.post("/api/auth/doctor/login")
async def login_doctor(request: DoctorLoginRequest):
    doctor = await doctors_collection.find_one({"doctorId": request.doctorId})
    if not doctor:
        raise HTTPException(status_code=404, detail="Doctor not found")
    
    if not verify_password(request.password, doctor["password"]):
        raise HTTPException(status_code=400, detail="Invalid password")
    
    token = create_access_token({"id": str(doctor["_id"]), "role": "Doctor"})
    return {"token": token, "user": {"id": str(doctor["_id"]), "role": "Doctor", "doctorId": doctor["doctorId"]}}

@app.post("/api/auth/logout")
async def logout():
    return {"msg": "Logged out"}



# --- Doctor Profile Routes ---
class DoctorUpdateRequest(BaseModel):
    doctorId: str = None
    name: str = None
    age: int = None
    hospital: str = None
    specialization: str = None

@app.get("/api/doctor")
async def get_doctor_profile(auth=Depends(get_current_user_id)):
    from bson import ObjectId
    user_id, role = auth
    if role != "Doctor":
        raise HTTPException(status_code=403, detail="Only doctors can access this route")
    try:
        doctor = await doctors_collection.find_one({"_id": ObjectId(user_id)})
        if not doctor:
            raise HTTPException(status_code=404, detail="Doctor not found")
        doctor["_id"] = str(doctor["_id"])
        doctor.pop("password", None)
        return doctor
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

# ──────────────────────────────────────────────
# HOSPITAL ENDPOINTS
# ──────────────────────────────────────────────

@app.get("/api/hospitals/by-place/{place_id}")
async def get_hospital_by_place(place_id: str):
    hospital = await hospitals_collection.find_one({"geoapifyPlaceId": place_id})  # ← await ADDED

    if not hospital:
        raise HTTPException(status_code=404, detail="Hospital not found or not a partner")

    hospital["_id"] = str(hospital["_id"])

    return {
        "isPartner": hospital.get("isPartner", False),
        "hospital": hospital
    }


@app.get("/api/hospitals/{hospital_id}/availability")
async def get_hospital_availability(hospital_id: str):
    try:
        hospital = await hospitals_collection.find_one({"_id": ObjectId(hospital_id)})  # ← await ADDED
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid hospital ID format")

    if not hospital:
        raise HTTPException(status_code=404, detail="Hospital not found")

    wards_cursor = hospital_wards_collection.find({"hospitalId": hospital_id})
    wards_list = await wards_cursor.to_list(length=None)  # ← FIXED: async cursor

    wards = []
    for ward in wards_list:
        available = (
            ward["totalBeds"]
            - ward["occupiedBeds"]
            - ward["reservedBeds"]
            - ward["maintenanceBeds"]
        )
        wards.append({
            "wardId": str(ward["_id"]),
            "wardType": ward["wardType"],
            "label": ward["label"],
            "totalBeds": ward["totalBeds"],
            "availableBeds": max(available, 0),
        })

    hospital["_id"] = str(hospital["_id"])

    return {
        "hospitalId": hospital_id,
        "hospitalName": hospital["name"],
        "lastInventoryUpdate": hospital.get("lastInventoryUpdate"),
        "amenities": hospital.get("amenities", []),
        "wards": wards
    }

# ──────────────────────────────────────────────
# BED BOOKING ENDPOINTS
# ──────────────────────────────────────────────

@app.post("/api/bed-bookings")
async def create_bed_booking(request: BedBookingCreate, auth=Depends(get_current_user_id)):
    user_id, role = auth

    if role != "Patient":
        raise HTTPException(status_code=403, detail="Only patients can book beds")

    try:
        hospital = await hospitals_collection.find_one({"_id": ObjectId(request.hospitalId)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid hospital ID")

    if not hospital:
        raise HTTPException(status_code=404, detail="Hospital not found")

    if not hospital.get("isPartner"):
        raise HTTPException(status_code=403, detail="Hospital is not a partner")

    try:
        ward = await hospital_wards_collection.find_one({"_id": ObjectId(request.wardId)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid ward ID")

    if not ward:
        raise HTTPException(status_code=404, detail="Ward not found")

    result = await hospital_wards_collection.update_one(
        {
            "_id": ObjectId(request.wardId),
            "$expr": {
                "$lt": [
                    {"$add": ["$occupiedBeds", "$reservedBeds", "$maintenanceBeds"]},
                    "$totalBeds"
                ]
            }
        },
        {"$inc": {"reservedBeds": 1}}
    )

    if result.modified_count == 0:
        raise HTTPException(status_code=409, detail="No beds available in this ward")

    now = datetime.utcnow()
    booking = {
        "hospitalId": request.hospitalId,
        "wardId": request.wardId,
        "patientId": str(user_id),
        "patientName": request.patientName,
        "patientContact": request.patientContact,
        "reason": request.reason,
        "expectedArrival": request.expectedArrival,
        "status": "pending",
        "holdExpiresAt": now + timedelta(minutes=15),
        "createdAt": now,
        "hospitalName": hospital.get("name"),
        "wardLabel": ward.get("label"),
        "wardType": ward.get("wardType")
    }

    booking_result = await bed_bookings_collection.insert_one(booking)
    booking["_id"] = str(booking_result.inserted_id)

    return {
        "message": "Bed booked successfully. Hold expires in 15 minutes.",
        "booking": booking
    }


@app.get("/api/home/profile")
async def get_patient_profile(auth=Depends(get_current_user_id)):
    user_id, role = auth
    if role != "Patient":
        raise HTTPException(status_code=403, detail="Not authorized")
    user = await users_collection.find_one({"_id": ObjectId(user_id)})
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user["_id"] = str(user["_id"])
    user.pop("password", None)
    return user

@app.get("/api/bed-bookings/my")
async def get_my_bed_bookings(auth=Depends(get_current_user_id)):
    user_id, role = auth

    if role != "Patient":
        raise HTTPException(status_code=403, detail="Only patients can view their bookings")

    bookings = await bed_bookings_collection.find(
        {"patientId": str(user_id)}
    ).sort("createdAt", -1).to_list(length=None)

    for b in bookings:
        b["_id"] = str(b["_id"])

    return bookings


@app.patch("/api/bed-bookings/{booking_id}/cancel")
async def cancel_bed_booking(booking_id: str, auth=Depends(get_current_user_id)):
    user_id, role = auth

    if role != "Patient":
        raise HTTPException(status_code=403, detail="Only patients can cancel bookings")

    try:
        booking = await bed_bookings_collection.find_one({
            "_id": ObjectId(booking_id),
            "patientId": str(user_id)
        })
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid booking ID")

    if not booking:
        raise HTTPException(status_code=404, detail="Booking not found")

    if booking["status"] in ["cancelled", "expired"]:
        raise HTTPException(status_code=400, detail=f"Booking is already {booking['status']}")

    await bed_bookings_collection.update_one(
        {"_id": ObjectId(booking_id)},
        {"$set": {"status": "cancelled"}}
    )

    if booking["status"] == "pending":
        await hospital_wards_collection.update_one(
            {"_id": ObjectId(booking["wardId"])},
            {"$inc": {"reservedBeds": -1}}
        )

    return {"message": "Booking cancelled successfully"}


@app.patch("/api/doctor/update")
async def update_doctor_profile(request: DoctorUpdateRequest, auth=Depends(get_current_user_id)):
    from bson import ObjectId
    user_id, role = auth
    if role != "Doctor":
        raise HTTPException(status_code=403, detail="Only doctors can access this route")
    if not request.name or not request.hospital or not request.age:
        raise HTTPException(status_code=400, detail="Name, hospital and age are required")
    if not (1 <= request.age <= 120):
        raise HTTPException(status_code=400, detail="Age must be between 1 and 120")

    try:
        update_data = {
            "name": request.name.strip(),
            "hospital": request.hospital.strip(),
            "age": request.age,
        }
        if request.specialization:
            update_data["specialization"] = request.specialization.strip()
        if request.doctorId:
            update_data["doctorId"] = request.doctorId.strip()

        result = await doctors_collection.find_one_and_update(
            {"_id": ObjectId(user_id)},
            {"$set": update_data},
            return_document=True
        )
        if not result:
            raise HTTPException(status_code=404, detail="Doctor not found")
        result["_id"] = str(result["_id"])
        result.pop("password", None)
        return {"msg": "Doctor details updated successfully", "user": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))



def extract_symptoms(text: str) -> list[str]:
    normalized = (text or "").lower()

    # Preferred: SpaCy phrase matcher (more accurate).
    if nlp is not None and matcher is not None:
        doc = nlp(text)
        matches = matcher(doc)
        symptoms_found = set()
        for _, start, end in matches:
            span = doc[start:end]
            symptoms_found.add(span.text.lower())
        return list(symptoms_found)

    # Fallback: simple keyword match (keeps API usable without SpaCy model).
    found = set()
    for symptom in symptom_list:
        # basic word-boundary-ish match for single-word symptoms
        if " " not in symptom:
            if re.search(rf"\b{re.escape(symptom)}\b", normalized):
                found.add(symptom)
        else:
            if symptom in normalized:
                found.add(symptom)
    return list(found)

@app.post("/api/symptom-recognition", response_model=SymptomResponse)
async def recognize_symptoms(request: SymptomRequest):
    symptoms = extract_symptoms(request.text)
    return SymptomResponse(symptoms=symptoms)

@app.post("/api/ai-diagnosis", response_model=DiagnosisResponse)
async def ai_diagnosis(request: SymptomRequest):
    text = request.text.lower()
    
    # --- Expert System Layer (Highest Priority) ---
    expert_conditions = {
        "Alopecia areata": ["hair loss", "patchy hair", "bald spot", "hair falling"],
        "Anaphylaxis": ["can't breathe", "throat swelling", "bee sting", "allergic reaction"],
        "Stable angina": ["chest pain", "tightness in chest", "heart pain"],
        "Pneumonia": ["cough with phlegm", "difficulty breathing", "chest congestion", "shaking chills"],
        "Bronchitis": ["persistent cough", "mucus in throat", "wheezing", "chest discomfort"],
        "Influenza": ["high fever", "body ache", "chills", "severe fatigue"],
        "Tuberculosis": ["coughing blood", "night sweats", "weight loss", "prolonged cough"],
        "GERD": ["heartburn", "acid reflux", "chest burn", "sour taste in mouth"],
        "Panic attack": ["sudden racing heart", "trembling", "intense fear", "dread"],
        "Cluster headache": ["severe eye pain", "headache behind eye", "intense one-sided headache"],
        "Viral pharyngitis": ["sore throat", "painful swallowing", "scratchy throat"],
        "Epiglottitis": ["noisy breathing", "drooling", "difficulty swallowing", "pale skin"],
        "Acute otitis media": ["ear pain", "clogged ear", "fluid in ear"],
        "Bronchospasm / acute asthma exacerbation": ["sudden wheezing", "gasping for air", "tight chest breath"],
        "Acute COPD exacerbation / infection": ["shortness of breath at rest", "increased mucus", "emphysema worsening"],
        "Chagas": ["swelling at infection site", "beetle bite fever", "unexplained heart issues"],
        "Myocarditis": ["inflamed heart", "heart muscle pain", "irregular pulse"],
        "Larygospasm": ["vocal cord spasm", "choking sensation", "sudden loss of voice"],
        "Localized edema": ["swollen ankle", "fluid retention", "limb swelling"],
        "SLE": ["butterfly rash", "joint pain with rash", "autoimmune fatigue"],
        "HIV (initial infection)": ["flu symptoms after exposure", "prolonged swollen glands", "unexplained night sweat"],
        "Myasthenia gravis": ["drooping eyelid", "double vision", "muscle weakness"],
        "Whooping cough": ["barking cough", "whooping sound", "cough fit"],
        "Allergic sinusitis": ["runny nose", "sneezing", "congestion sinus"],
        "Acute laryngitis": ["hoarse voice", "lost voice", "throat irritation"],
        "Croup": ["seal-like bark", "noisy breathing child", "stridor"],
        "Anemia": ["pale skin", "feeling cold", "extreme weakness", "lack of iron"],
        "Atrial fibrillation": ["fast heart rate", "fluttering heart", "skipping beats"]
    }

    for condition, keywords in expert_conditions.items():
        if any(k in text for k in keywords):
            metadata = CONDITION_METADATA.get(condition)
            if metadata:
                return DiagnosisResponse(
                    diagnosis=condition,
                    description=metadata["description"],
                    how_it_happens=metadata["how_it_happens"],
                    advice=metadata["advice"],
                    specialist=metadata["specialist"],
                    confidence=0.95 # High confidence for direct keyword matches
                )

    # --- BERT Model Layer (Fallback) ---
    ensure_bert_loaded()
    if not model or not tokenizer:
        return DiagnosisResponse(
            diagnosis="AI Model not available", 
            description="Our primary AI engine is offline. Please try again later.",
            how_it_happens="N/A",
            advice="Consult a doctor immediately.",
            specialist="General",
            confidence=0.0
        )
    
    inputs = tokenizer(request.text, return_tensors="pt", truncation=True, padding=True, max_length=128)
    with torch.no_grad():
        outputs = model(**inputs)
    
    logits = outputs.logits
    probs = torch.nn.functional.softmax(logits, dim=1)
    confidence, predicted_class_id = torch.max(probs, dim=1)
    
    diagnosis = LABELS[predicted_class_id.item()] if predicted_class_id.item() < len(LABELS) else "Unknown Condition"
    
    metadata = CONDITION_METADATA.get(diagnosis, {
        "description": "Consult a healthcare professional for a detailed evaluation.",
        "how_it_happens": "Mechanism not fully documented in this version.",
        "advice": "Follow general wellness guidelines.",
        "specialist": "General"
    })
    
    return DiagnosisResponse(
        diagnosis=diagnosis, 
        description=metadata["description"],
        how_it_happens=metadata["how_it_happens"],
        advice=metadata["advice"],
        specialist=metadata["specialist"],
        confidence=float(confidence.item())
    )

@app.post("/api/analyze-report", response_model=ReportAnalysisResponse)
async def analyze_report(request: ReportAnalysisRequest):
    try:
        # 1. Download file from Appwrite Storage
        file_bytes = storage_service.get_file_download(REPORTS_BUCKET_ID, request.fileId)
        
        # 2. Extract Text
        text = ""
        try:
            # Try PDF
            pdf_doc = fitz.open(stream=file_bytes, filetype="pdf")
            for page in pdf_doc:
                text += page.get_text()
            pdf_doc.close()
        except:
            # Try Image (OCR placeholder or metadata)
            text = "Report Analysis limited for image files. Please upload PDF for detailed analysis."

        if not text.strip():
            text = "No readable text found in the report."

        # 3. Analyze Symptoms and History
        detected = extract_symptoms(text)
        
        # 4. Generate AI Summary (Heuristic based on detected symptoms)
        history = f"Based on the report, we detected indications of: {', '.join(detected) if detected else 'None recorded'}. "
        
        care_instructions = [
            "Maintain regular follow-ups with your physician.",
            "Keep a digital log of any recurring symptoms.",
            "Bring this report to your next appointment."
        ]
        
        if any(s in detected for s in ["diabetes", "hypertension"]):
            care_instructions.append("Monitor blood glucose/pressure levels daily.")
            care_instructions.append("Follow a low-sodium/low-sugar diet as prescribed.")
        
        if "asthma" in detected or "cough" in detected:
            care_instructions.append("Avoid known allergens and triggers.")
            care_instructions.append("Ensure your inhaler is always accessible.")

        return ReportAnalysisResponse(
            history=history,
            mandatory_care=care_instructions,
            detected_symptoms=detected
        )
    except Exception as e:
        print(f"Report Analysis Error: {e}")
        raise HTTPException(status_code=500, detail=str(e))

@app.post("/api/assistant-guide", response_model=AssistantResponse)
async def assistant_guide(request: AssistantRequest):
    text = request.text.lower()
    
    # 1. Broad Health & Wellness Advice
    health_triggers = {
        "headache": "For a headache, stay hydrated and try a darkened room. Avoid bright screens. If it's accompanied by vision changes, seek urgent care.",
        "fever": "Rest and drink plenty of fluids. Acetaminophen or ibuprofen can help reduce fever, but consult a professional if it exceeds 103°F (39.4°C).",
        "cough": "Warm liquids with honey can soothe a cough. Use a humidifier at night. If you're coughing up blood, see a specialist immediately.",
        "hair": "Patchy hair loss (like Alopecia) can be stressful. We recommend using our AI Diagnosis for a preliminary check and then seeing a Dermatologist.",
        "anemia": "Focus on iron-rich foods like spinach, lentils, and lean proteins. Avoid tea/coffee with meals.",
        "alopecia": "Alopecia areata is an autoimmune condition. Treatment often involves steroids or other immunotherapy. See a Dermatologist for a tailored plan.",
        "stress": "Deep breathing and mindfulness can help. If stress is affecting your physical health, consider speaking with a mental health professional.",
        "skin": "For skin issues, avoid harsh chemicals. Keep the area clean and hydrated. A Dermatologist is the best specialist for skin concerns."
    }

    for trigger, reply in health_triggers.items():
        if trigger in text:
            return AssistantResponse(reply=reply)

    # 2. Comprehensive App Navigation Guidance
    nav_triggers = {
        "report": "To upload a report, go to 'Your Reports' → '+' icon. We support PDFs for deep AI analysis!",
        "upload": "Files can be uploaded from the 'Your Reports' screen. Just tap the plus icon and select your file.",
        "profile": "You can update your personal info, age, and blood group in the 'Edit Profile' section found on the dashboard.",
        "diagnosis": "The 'AI Diagnosis' feature uses BERT to analyze symptoms. It also recommends the right specialist for you.",
        "book": "Ready to see a doctor? Use 'Book Appointment' to schedule a live visit with a specialist near you.",
        "appointment": "You can manage your upcoming visits in the 'Upcoming Appointments' card on your dashboard.",
        "hospital": "Find the best facilities near you using 'Nearby Hospitals'. You can filter them by specialty.",
        "doctor": "Specialists are listed under 'Nearby Hospitals' details. Tap a hospital to see who works there."
    }

    for trigger, reply in nav_triggers.items():
        if trigger in text:
            return AssistantResponse(reply=reply)
    
    # 3. Conversational Fallback
    return AssistantResponse(reply="I'm your MediRaksha Assistant! I can help you navigate the app or give wellness tips. Ask me about your symptoms, how to upload a report, or how to book a doctor!")

# --- Slots & Appointments Collections ---
slots_collection = db.get_collection("slots")
appointments_collection = db.get_collection("appointments")
reviews_collection = db.get_collection("doctor_reviews")
reports_collection = db.get_collection("reports")

class SlotCreateRequest(BaseModel):
    doctorId: str
    date: str
    times: list[str]

class WeeklySlotCreateRequest(BaseModel):
    doctorId: str
    startDate: str
    weeks: int = 1
    weekdays: list[int]
    times: list[str]

class BookSlotRequest(BaseModel):
    slotId: Optional[str] = None
    doctorId: Optional[str] = None
    date: Optional[str] = None
    time: Optional[str] = None
    patient: dict = {}

class AppointmentCompleteRequest(BaseModel):
    reportIds: list[str] = []

@app.post("/api/slots/create")
async def create_slots(request: SlotCreateRequest, auth=Depends(get_current_user_id)):
    user_id, role = auth
    if role != "Doctor" or str(user_id) != request.doctorId:
        raise HTTPException(status_code=403, detail="Not authorized to create slots for this doctor")
    
    times = list(set([t.strip() for t in request.times if t.strip()]))
    if not times:
        raise HTTPException(status_code=400, detail="No valid times provided")
        
    date_str = request.date.strip()
    
    # Check existing
    existing = await slots_collection.find({
        "doctorId": request.doctorId,
        "date": date_str,
        "time": {"$in": times}
    }).to_list(length=None)
    
    existing_times = {s["time"] for s in existing}
    new_times = [t for t in times if t not in existing_times]
    
    if not new_times:
        return {"msg": "Selected slots already exist", "createdCount": 0}
        
    docs = [
        {
            "doctorId": request.doctorId,
            "date": date_str,
            "time": t,
            "status": "available"
        }
        for t in new_times
    ]
    result = await slots_collection.insert_many(docs)
    return {"msg": "Slots published successfully", "createdCount": len(result.inserted_ids)}

@app.post("/api/slots/create-weekly")
async def create_weekly_slots(request: WeeklySlotCreateRequest, auth=Depends(get_current_user_id)):
    user_id, role = auth
    if role != "Doctor" or str(user_id) != request.doctorId:
        raise HTTPException(status_code=403, detail="Not authorized to create slots for this doctor")

    times = list(set([t.strip() for t in request.times if t.strip()]))
    weekdays = sorted(set([d for d in request.weekdays if 0 <= d <= 6]))
    weeks = max(1, min(request.weeks, 12))
    if not times or not weekdays:
        raise HTTPException(status_code=400, detail="Select at least one weekday and one time")

    try:
        import datetime
        start_date = datetime.datetime.strptime(request.startDate.strip(), "%Y-%m-%d").date()
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid start date")

    candidate_dates = []
    for offset in range(weeks * 7):
        current = start_date + datetime.timedelta(days=offset)
        if current.weekday() in weekdays:
            candidate_dates.append(current.isoformat())

    existing = await slots_collection.find({
        "doctorId": request.doctorId,
        "date": {"$in": candidate_dates},
        "time": {"$in": times}
    }).to_list(length=None)
    existing_keys = {(s["date"], s["time"]) for s in existing}

    docs = [
        {"doctorId": request.doctorId, "date": d, "time": t, "status": "available"}
        for d in candidate_dates
        for t in times
        if (d, t) not in existing_keys
    ]
    if not docs:
        return {"msg": "Selected weekly slots already exist", "createdCount": 0}

    result = await slots_collection.insert_many(docs)
    return {"msg": "Weekly slots published successfully", "createdCount": len(result.inserted_ids)}

@app.get("/api/slots/doctors")
async def get_doctors_with_slots():
    from bson import ObjectId
    # Find active slots
    pipeline = [
        {"$match": {"status": "available"}},
        {"$sort": {"date": 1, "time": 1}},
        {"$group": {
            "_id": "$doctorId",
            "availability": {"$addToSet": {"$concat": ["$date", " | ", "$time"]}}
        }}
    ]
    slots_agg = await slots_collection.aggregate(pipeline).to_list(length=None)
    
    results = []
    for s in slots_agg:
        doc_id = s["_id"]
        try:
            doctor = await doctors_collection.find_one({"_id": ObjectId(doc_id)})
            if doctor:
                results.append({
                    "_id": str(doctor["_id"]),
                    "name": doctor.get("name", "Unknown Doctor"),
                    "hospital": doctor.get("hospital", "Unknown Hospital"),
                    "specialization": doctor.get("specialization", "General"),
                    "availability": s["availability"]
                })
        except:
            pass
            
    # Also include ALL verified doctors even if no active slots, to match frontend expectations
    all_doctors = await doctors_collection.find({}).to_list(length=None)
    doc_dict = {d["_id"]: d for d in results}
    for d in all_doctors:
        d_id = str(d["_id"])
        if d_id not in doc_dict and d.get("name"):
            results.append({
                "_id": d_id,
                "name": d.get("name", "Unknown Doctor"),
                "hospital": d.get("hospital", "Unknown Hospital"),
                "specialization": d.get("specialization", "General"),
                "availability": []
            })
            
    return results

@app.get("/api/slots/my")
async def get_my_slots(auth=Depends(get_current_user_id)):
    user_id, role = auth
    if role != "Doctor":
        raise HTTPException(status_code=403, detail="Only doctors can view their own slots via this endpoint")
        
    pipeline = [
        {"$match": {"doctorId": str(user_id), "status": "available"}},
        {"$sort": {"date": 1, "time": 1}},
        {"$group": {
            "_id": "$doctorId",
            "availability": {"$addToSet": {"$concat": ["$date", " | ", "$time"]}}
        }}
    ]
    slots_agg = await slots_collection.aggregate(pipeline).to_list(length=None)
    return slots_agg

@app.get("/api/slots/my/details")
async def get_my_slot_details(auth=Depends(get_current_user_id)):
    user_id, role = auth
    if role != "Doctor":
        raise HTTPException(status_code=403, detail="Only doctors can view their own slots")

    slots = await slots_collection.find({"doctorId": str(user_id)}).sort([("date", 1), ("time", 1)]).to_list(length=None)
    for slot in slots:
        slot["_id"] = str(slot["_id"])
    return slots

@app.delete("/api/slots/{slot_id}")
async def cancel_slot(slot_id: str, auth=Depends(get_current_user_id)):
    user_id, role = auth
    if role != "Doctor":
        raise HTTPException(status_code=403, detail="Only doctors can cancel slots")
    try:
        result = await slots_collection.update_one(
            {"_id": ObjectId(slot_id), "doctorId": str(user_id), "status": "available"},
            {"$set": {"status": "cancelled"}}
        )
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid slot ID")
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Available slot not found")
    return {"message": "Slot cancelled"}

@app.get("/api/slots/{doctor_id}/{date}")
async def get_doctor_slots_by_date(doctor_id: str, date: str):
    slots = await slots_collection.find({
        "doctorId": doctor_id,
        "date": date,
        "status": "available"
    }).sort("time", 1).to_list(length=None)
    
    # Format for response
    for s in slots:
        s["_id"] = str(s["_id"])
        
    return slots

@app.post("/api/slots/book")
async def book_slot(request: BookSlotRequest, auth=Depends(get_current_user_id)):
    from bson import ObjectId
    import datetime
    user_id, role = auth
    if role != "Patient":
        raise HTTPException(status_code=403, detail="Only patients can book appointments")

    slot_object_id = None
    try:
        if request.slotId:
            try:
                slot_object_id = ObjectId(request.slotId)
            except Exception:
                raise HTTPException(status_code=400, detail="Invalid slot ID")
            slot = await slots_collection.find_one({"_id": slot_object_id})
        else:
            if not request.doctorId or not request.date or not request.time:
                raise HTTPException(status_code=400, detail="Slot ID or doctor/date/time is required")
            slot = await slots_collection.find_one({
                "doctorId": request.doctorId,
                "date": request.date,
                "time": request.time,
                "status": "available"
            })
            if slot:
                slot_object_id = slot["_id"]

        if not slot or slot.get("status") != "available":
            raise HTTPException(status_code=409, detail="This slot is not available")
            
        doctor = await doctors_collection.find_one({"_id": ObjectId(slot["doctorId"])})
        if not doctor:
            raise HTTPException(status_code=404, detail="Doctor not found")
            
        result = await slots_collection.update_one(
            {"_id": slot_object_id, "status": "available"},
            {"$set": {"status": "booked"}}
        )
        if result.modified_count == 0:
            raise HTTPException(status_code=409, detail="This slot is not available")
        
        appointment_date = datetime.datetime.strptime(f"{slot['date']}T00:00:00", "%Y-%m-%dT%H:%M:%S")
        patient_data = request.patient
        notes = patient_data.get("notes", "Mobile App Booking")
        
        appointment = {
            "patientId": str(user_id),
            "doctorId": slot["doctorId"],
            "slotId": str(slot["_id"]),
            "slotTime": slot["time"],
            "doctorName": doctor.get("name", "Unknown Doctor"),
            "speciality": doctor.get("specialization", "General Physician"),
            "hospitalName": doctor.get("hospital", "Unknown Hospital"),
            "appointmentDate": appointment_date,
            "patientName": patient_data.get("name", "Anonymous"),
            "patientContact": patient_data.get("phone", ""),
            "reasonOfAppointment": notes,
            "status": "confirmed",
            "createdAt": datetime.datetime.utcnow()
        }
        
        result = await appointments_collection.insert_one(appointment)
        return {"message": "Appointment confirmed", "appointment": {"_id": str(result.inserted_id)}}
    except HTTPException:
        raise
    except Exception as e:
        if slot_object_id:
            await slots_collection.update_one({"_id": slot_object_id}, {"$set": {"status": "available"}})
        raise HTTPException(status_code=500, detail=str(e))

# --- Sync Dashboards (Appointments & Patients) ---

@app.get("/api/home/appointments")
async def get_patient_appointments(auth=Depends(get_current_user_id)):
    user_id, role = auth
    if role != "Patient":
        raise HTTPException(status_code=403, detail="Not authorized")
    appointments = await appointments_collection.find({"patientId": str(user_id)}).sort("appointmentDate", 1).to_list(length=None)
    for a in appointments:
        a["_id"] = str(a["_id"])
    return appointments

@app.get("/api/doctor/appointments")
async def get_doctor_appointments(auth=Depends(get_current_user_id)):
    user_id, role = auth
    if role != "Doctor":
        raise HTTPException(status_code=403, detail="Not authorized")
    appointments = await appointments_collection.find({"doctorId": str(user_id)}).sort("appointmentDate", 1).to_list(length=None)
    for a in appointments:
        a["_id"] = str(a["_id"])
        patient = None
        try:
            patient = await users_collection.find_one({"_id": ObjectId(a.get("patientId"))})
        except Exception:
            patient = None
        if patient:
            a["patient"] = {
                "id": str(patient["_id"]),
                "name": patient.get("name", a.get("patientName", "Unknown Patient")),
                "age": patient.get("age"),
                "gender": patient.get("gender"),
                "email": patient.get("email"),
                "phoneNumber": patient.get("phoneNumber", a.get("patientContact", "")),
            }
        else:
            a["patient"] = {
                "id": a.get("patientId"),
                "name": a.get("patientName", "Unknown Patient"),
                "phoneNumber": a.get("patientContact", ""),
            }
        a["date"] = a.get("appointmentDate")
        a["startTime"] = a.get("slotTime", "")
        a["reason"] = a.get("reasonOfAppointment", "")

        latest_reports = await reports_collection.find({
            "patientId": a.get("patientId"),
            "status": {"$ne": "destroyed"}
        }).sort("uploadedAt", -1).limit(3).to_list(length=None)
        for report in latest_reports:
            report["_id"] = str(report["_id"])
        a["latestReports"] = latest_reports
    return appointments

class AppointmentStatusUpdate(BaseModel):
    status: str

@app.patch("/api/doctor/appointments/{target_id}")
async def update_appointment_status(target_id: str, request: AppointmentStatusUpdate, auth=Depends(get_current_user_id)):
    from bson import ObjectId
    user_id, role = auth
    if role != "Doctor":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    result = await appointments_collection.update_one(
        {"_id": ObjectId(target_id), "doctorId": str(user_id)},
        {"$set": {"status": request.status}}
    )
    if result.matched_count == 0:
        raise HTTPException(status_code=404, detail="Appointment not found")
        
    return {"message": f"Appointment marked as {request.status}"}

@app.patch("/api/doctor/appointments/{target_id}/complete")
async def complete_appointment(target_id: str, request: AppointmentCompleteRequest, auth=Depends(get_current_user_id)):
    user_id, role = auth
    if role != "Doctor":
        raise HTTPException(status_code=403, detail="Not authorized")

    try:
        appointment = await appointments_collection.find_one({"_id": ObjectId(target_id), "doctorId": str(user_id)})
    except Exception:
        raise HTTPException(status_code=400, detail="Invalid appointment ID")

    if not appointment:
        raise HTTPException(status_code=404, detail="Appointment not found")

    await appointments_collection.update_one(
        {"_id": ObjectId(target_id)},
        {"$set": {"status": "completed", "completedAt": datetime.utcnow(), "reportsDestroyed": True}}
    )

    report_query = {"patientId": appointment.get("patientId")}
    if request.reportIds:
        valid_ids = []
        for report_id in request.reportIds:
            try:
                valid_ids.append(ObjectId(report_id))
            except Exception:
                pass
        if valid_ids:
            report_query["_id"] = {"$in": valid_ids}

    await reports_collection.update_many(
        report_query,
        {"$set": {"status": "destroyed", "destroyedAt": datetime.utcnow(), "destroyedByAppointmentId": target_id}}
    )
    return {"message": "Appointment completed and shared reports self-destructed"}

@app.get("/api/doctor/reviews")
async def get_doctor_reviews(auth=Depends(get_current_user_id)):
    user_id, role = auth
    if role != "Doctor":
        raise HTTPException(status_code=403, detail="Not authorized")

    reviews = await reviews_collection.find({"doctorId": str(user_id)}).sort("createdAt", -1).to_list(length=20)
    for review in reviews:
        review["_id"] = str(review["_id"])
    avg = round(sum([float(r.get("rating", 0)) for r in reviews]) / len(reviews), 1) if reviews else 0
    return {"averageRating": avg, "count": len(reviews), "reviews": reviews}

@app.get("/api/doctor/shared-reports")
async def get_doctor_shared_reports(auth=Depends(get_current_user_id)):
    user_id, role = auth
    if role != "Doctor":
        raise HTTPException(status_code=403, detail="Not authorized")

    appointments = await appointments_collection.find({"doctorId": str(user_id)}).to_list(length=None)
    patient_ids = list({a.get("patientId") for a in appointments if a.get("patientId")})
    reports = await reports_collection.find({
        "patientId": {"$in": patient_ids},
        "status": {"$ne": "destroyed"}
    }).sort("uploadedAt", -1).to_list(length=50)
    for report in reports:
        report["_id"] = str(report["_id"])
    return reports

@app.get("/api/doctor/patients")
async def get_doctor_patients(auth=Depends(get_current_user_id)):
    user_id, role = auth
    if role != "Doctor":
        raise HTTPException(status_code=403, detail="Not authorized")
    
    appointments = await appointments_collection.find({"doctorId": str(user_id)}).to_list(length=None)
    
    seen = set()
    patients = []
    for a in appointments:
        pid = a.get("patientId")
        if pid and pid not in seen:
            seen.add(pid)
            patient = None
            try:
                patient = await users_collection.find_one({"_id": ObjectId(pid)})
            except Exception:
                patient = None
            patient_appointments = []
            for appt in appointments:
                if appt.get("patientId") == pid:
                    patient_appointments.append({
                        "_id": str(appt.get("_id")),
                        "date": appt.get("appointmentDate"),
                        "time": appt.get("slotTime", ""),
                        "status": appt.get("status", ""),
                        "reason": appt.get("reasonOfAppointment", ""),
                    })
            patients.append({
                "_id": pid,
                "patientId": pid,
                "name": (patient or {}).get("name", a.get("patientName", "Unknown Patient")),
                "age": (patient or {}).get("age"),
                "gender": (patient or {}).get("gender"),
                "email": (patient or {}).get("email"),
                "contact": (patient or {}).get("phoneNumber", a.get("patientContact", "")),
                "appointments": patient_appointments,
            })
    return patients


if __name__ == "__main__":
    import uvicorn
    import socket

    # Help user find their local IP
    hostname = socket.gethostname()
    local_ip = socket.gethostbyname(hostname)
    print(f"\n🚀 Server starting at: http://{local_ip}:8000")
    print(f"👉 Use this IP in your frontend constants/config.ts\n")
    
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=True)
