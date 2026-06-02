from pymongo import MongoClient
from dotenv import load_dotenv
import os
BASE_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(os.path.join(BASE_DIR, "Backend", ".env"))

MONGO_URI = os.getenv("MONGO_URI")
print("Connecting to:", MONGO_URI)
client = MongoClient(os.getenv("MONGO_URI"))
db = client["test"]   # ← replace with your actual DB name

for h in db["hospitals"].find():
    print(h["name"], "→", h["geoapifyPlaceId"])