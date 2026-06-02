import sys
import os
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from pymongo import MongoClient
from datetime import datetime, timezone
from dotenv import load_dotenv

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
BACKEND_DIR = os.path.join(ROOT_DIR, "Backend")
sys.path.append(BACKEND_DIR)

load_dotenv(os.path.join(BACKEND_DIR, ".env"))

MONGO_URI = os.getenv("MONGO_URI")
client = MongoClient(MONGO_URI)
db = client["test"]  # same database as Backend/main.py

hospitals_col = db["hospitals"]
wards_col = db["hospital_wards"]

# ──────────────────────────────────────────────
# STEP 1 — Clear ALL old data (wipe completely)
# ──────────────────────────────────────────────
hospitals_col.delete_many({})   # ← FIXED: wipe all, not just {"updatedBy": "seed"}
wards_col.delete_many({})       # ← FIXED: wipe all old wards too
print("Cleared all old hospitals and wards")


# ──────────────────────────────────────────────
# STEP 2 — Insert hospitals
# ──────────────────────────────────────────────
hospitals = [
    {
        "name": "Popular Hospital",
        "geoapifyPlaceId": "515684f6451dbe544059e15e99b7ea4a3940f00103f90167d14da301000000920310506f70756c617220486f73706974616c",
        "address": "Varanasi, Uttar Pradesh",
        "latitude": 25.3176,
        "longitude": 82.9739,
        "phone": "",
        "amenities": ["icu", "emergency", "pharmacy", "ambulance"],
        "isPartner": True,
        "lastInventoryUpdate": datetime.now(timezone.utc),
        "updatedBy": "seed"
    },
    {
        "name": "Banaras Medicity Heart & Super Speciality Hospital",
        "geoapifyPlaceId": "51c85f5ad427bf54405931332207db4e3940f00103f901e9fef2be0100000092033242616e61726173204d656469636974792048656172742026205375706572205370656369616c69747920486f73706974616c",
        "address": "Varanasi, Uttar Pradesh",
        "latitude": 25.3176,
        "longitude": 82.9739,
        "phone": "",
        "amenities": ["icu", "emergency", "pharmacy", "ambulance", "blood_bank"],
        "isPartner": True,
        "lastInventoryUpdate": datetime.now(timezone.utc),
        "updatedBy": "seed"
    }
]

result = hospitals_col.insert_many(hospitals)
hospital_ids = result.inserted_ids
print(f"Inserted {len(hospital_ids)} hospitals")


# ──────────────────────────────────────────────
# STEP 3 — Insert wards for each hospital
# ──────────────────────────────────────────────
wards = [
    # ── Popular Hospital ──
    {
        "hospitalId": str(hospital_ids[0]),
        "wardType": "general",
        "label": "General Ward",
        "totalBeds": 40,
        "occupiedBeds": 28,
        "reservedBeds": 0,
        "maintenanceBeds": 1
    },
    {
        "hospitalId": str(hospital_ids[0]),
        "wardType": "icu",
        "label": "Intensive Care Unit",
        "totalBeds": 10,
        "occupiedBeds": 8,
        "reservedBeds": 0,
        "maintenanceBeds": 0
    },
    {
        "hospitalId": str(hospital_ids[0]),
        "wardType": "emergency",
        "label": "Emergency Ward",
        "totalBeds": 15,
        "occupiedBeds": 6,
        "reservedBeds": 0,
        "maintenanceBeds": 2
    },
    {
        "hospitalId": str(hospital_ids[0]),
        "wardType": "pediatric",
        "label": "Pediatric Ward",
        "totalBeds": 12,
        "occupiedBeds": 5,
        "reservedBeds": 0,
        "maintenanceBeds": 0
    },

    # ── Banaras Medicity ──
    {
        "hospitalId": str(hospital_ids[1]),
        "wardType": "general",
        "label": "General Ward",
        "totalBeds": 30,
        "occupiedBeds": 20,
        "reservedBeds": 0,
        "maintenanceBeds": 0
    },
    {
        "hospitalId": str(hospital_ids[1]),
        "wardType": "icu",
        "label": "Intensive Care Unit",
        "totalBeds": 8,
        "occupiedBeds": 7,
        "reservedBeds": 0,
        "maintenanceBeds": 1
    },
    {
        "hospitalId": str(hospital_ids[1]),
        "wardType": "pediatric",
        "label": "Pediatric Ward",
        "totalBeds": 10,
        "occupiedBeds": 3,
        "reservedBeds": 0,
        "maintenanceBeds": 0
    },
]

wards_col.insert_many(wards)
print(f"Inserted {len(wards)} wards")


# ──────────────────────────────────────────────
# STEP 4 — Print summary to verify
# ──────────────────────────────────────────────
print("\n-- Seed complete --")
for hid in hospital_ids:
    hospital = hospitals_col.find_one({"_id": hid})
    wards_for_h = list(wards_col.find({"hospitalId": str(hid)}))
    print(f"\n{hospital['name']}  (id: {hid})")
    print(f"  geoapifyPlaceId: {hospital['geoapifyPlaceId'][:40]}...")
    for w in wards_for_h:
        available = w['totalBeds'] - w['occupiedBeds'] - w['reservedBeds'] - w['maintenanceBeds']
        print(f"  [{w['wardType']}] {w['label']} -> {available} beds available")