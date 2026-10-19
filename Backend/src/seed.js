import { pool } from "./config/db.js";

export default async function seed() {
    try {
        console.log("Starting database seeding and schema alignment...");

        // 1. CREATE ENUM TYPES
        const createEnumsQuery = `
            DO $$ 
            BEGIN
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'gender_enum') THEN
                    CREATE TYPE gender_enum AS ENUM ('male', 'female', 'other');
                END IF;
                
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'appointment_status_enum') THEN
                    CREATE TYPE appointment_status_enum AS ENUM ('pending', 'confirmed', 'cancelled', 'completed', 'missed');
                ELSE
                    ALTER TYPE appointment_status_enum ADD VALUE IF NOT EXISTS 'missed';
                END IF;
                
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'slot_status_enum') THEN
                    CREATE TYPE slot_status_enum AS ENUM ('available', 'booked', 'blocked', 'completed', 'missed');
                ELSE
                    ALTER TYPE slot_status_enum ADD VALUE IF NOT EXISTS 'completed';
                    ALTER TYPE slot_status_enum ADD VALUE IF NOT EXISTS 'missed';
                END IF;
                
                IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_category_enum') THEN
                    CREATE TYPE report_category_enum AS ENUM ('lab', 'prescription', 'scan', 'other', 'discharge');
                END IF;
            END $$;
        `;
        await pool.query(createEnumsQuery);

        // 2. CREATE CORE & V2 EXTENDED TABLES
        const createTablesQuery = `
            -- Doctor Table
            CREATE TABLE IF NOT EXISTS "Doctor" (
                "id" SERIAL PRIMARY KEY,
                "name" VARCHAR NOT NULL,
                "email" VARCHAR UNIQUE NOT NULL,
                "number" VARCHAR,
                "age" INTEGER,
                "gender" gender_enum,
                "hospital" VARCHAR,
                "speciality" VARCHAR,
                "latitude" NUMERIC(10, 7),
                "longitude" NUMERIC(10, 7),
                "address" TEXT,
                "experience" INTEGER DEFAULT 8,
                "rating" NUMERIC(3, 2) DEFAULT 4.8,
                "password" VARCHAR NOT NULL,
                "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );
            ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "latitude" NUMERIC(10, 7);
            ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "longitude" NUMERIC(10, 7);
            ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "address" TEXT;
            ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "experience" INTEGER DEFAULT 8;
            ALTER TABLE "Doctor" ADD COLUMN IF NOT EXISTS "rating" NUMERIC(3, 2) DEFAULT 4.8;

            -- User Table
            CREATE TABLE IF NOT EXISTS "User" (
                "id" SERIAL PRIMARY KEY,
                "name" VARCHAR NOT NULL,
                "email" VARCHAR UNIQUE NOT NULL,
                "number" VARCHAR,
                "age" INTEGER,
                "gender" gender_enum,
                "registeredDoctorId" INTEGER,
                "password" VARCHAR NOT NULL,
                "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Slot Table
            CREATE TABLE IF NOT EXISTS "Slot" (
                "id" SERIAL PRIMARY KEY,
                "userId" INTEGER,
                "doctorId" INTEGER NOT NULL,
                "bookingDate" DATE NOT NULL,
                "slotTime" TIME NOT NULL DEFAULT '09:00',
                "status" slot_status_enum DEFAULT 'available',
                "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Appointment Table
            CREATE TABLE IF NOT EXISTS "Appointment" (
                "id" SERIAL PRIMARY KEY,
                "userId" INTEGER NOT NULL,
                "doctorId" INTEGER NOT NULL,
                "slotId" INTEGER NOT NULL,
                "requestGroupId" INTEGER,
                "slotTime" TIME,
                "appointmentDate" DATE NOT NULL,
                "reasonOfAppointment" VARCHAR,
                "status" appointment_status_enum DEFAULT 'pending',
                "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Report Table
            CREATE TABLE IF NOT EXISTS "Report" (
                "id" SERIAL PRIMARY KEY,
                "recordId" VARCHAR,
                "userId" INTEGER NOT NULL,
                "uploadedBy" VARCHAR,
                "doctorId" INTEGER,
                "doctorName" VARCHAR,
                "specialization" VARCHAR,
                "hospital" VARCHAR,
                "visitDate" DATE,
                "title" VARCHAR NOT NULL,
                "category" VARCHAR,
                "notes" TEXT,
                "fileSize" INTEGER,
                "fileData" TEXT,
                "mimeType" VARCHAR,
                "visibility" VARCHAR DEFAULT 'private',
                "originalFileName" VARCHAR,
                "isImportant" BOOLEAN DEFAULT false,
                "isArchived" BOOLEAN DEFAULT false,
                "isPinned" BOOLEAN DEFAULT false,
                "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Ensure columns in Report if table pre-existed
            ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "recordId" VARCHAR;
            ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "doctorName" VARCHAR;
            ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "specialization" VARCHAR;
            ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "hospital" VARCHAR;
            ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "visitDate" DATE;
            ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "notes" TEXT;
            ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "visibility" VARCHAR DEFAULT 'private';
            ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "isImportant" BOOLEAN DEFAULT false;
            ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "isArchived" BOOLEAN DEFAULT false;
            ALTER TABLE "Report" ADD COLUMN IF NOT EXISTS "isPinned" BOOLEAN DEFAULT false;

            -- Appointment Report Table
            CREATE TABLE IF NOT EXISTS "AppointmentReport" (
                "id" SERIAL PRIMARY KEY,
                "appointmentId" INTEGER NOT NULL,
                "userId" INTEGER NOT NULL,
                "fileName" VARCHAR NOT NULL,
                "fileUrl" VARCHAR,
                "fileData" TEXT,
                "fileSize" INTEGER,
                "mimeType" VARCHAR,
                "uploaded_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Record Tagging System
            CREATE TABLE IF NOT EXISTS "RecordTag" (
                "id" SERIAL PRIMARY KEY,
                "userId" INTEGER NOT NULL,
                "name" VARCHAR NOT NULL,
                "color" VARCHAR DEFAULT 'indigo',
                "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS "ReportTagAssignment" (
                "reportId" INTEGER NOT NULL,
                "tagId" INTEGER NOT NULL,
                "assigned_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY ("reportId", "tagId")
            );

            -- Record Collections System
            CREATE TABLE IF NOT EXISTS "Collection" (
                "id" SERIAL PRIMARY KEY,
                "userId" INTEGER NOT NULL,
                "name" VARCHAR NOT NULL,
                "description" TEXT,
                "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS "CollectionRecord" (
                "collectionId" INTEGER NOT NULL,
                "reportId" INTEGER NOT NULL,
                "added_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                PRIMARY KEY ("collectionId", "reportId")
            );

            -- Inter-record Connections Graph
            CREATE TABLE IF NOT EXISTS "ReportConnection" (
                "id" SERIAL PRIMARY KEY,
                "sourceReportId" INTEGER NOT NULL,
                "targetReportId" INTEGER NOT NULL,
                "userId" INTEGER NOT NULL,
                "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Audit Logs for Records
            CREATE TABLE IF NOT EXISTS "RecordActivity" (
                "id" SERIAL PRIMARY KEY,
                "reportId" INTEGER NOT NULL,
                "userId" INTEGER NOT NULL,
                "action" VARCHAR NOT NULL,
                "detail" TEXT,
                "createdAt" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Patient Health Summary
            CREATE TABLE IF NOT EXISTS "PatientSummary" (
                "id" SERIAL PRIMARY KEY,
                "userId" INTEGER UNIQUE NOT NULL,
                "bloodGroup" VARCHAR,
                "knownConditions" TEXT,
                "allergies" TEXT,
                "emergencyContact" VARCHAR,
                "healthRemarks" TEXT,
                "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Community Reviews System
            CREATE TABLE IF NOT EXISTS "Reviews" (
                "id" SERIAL PRIMARY KEY,
                "entityType" VARCHAR(20) NOT NULL CHECK ("entityType" IN ('hospital','doctor','platform')),
                "entityId" VARCHAR(100),
                "rating" SMALLINT NOT NULL CHECK ("rating" BETWEEN 1 AND 5),
                "reviewText" TEXT,
                "authorName" VARCHAR(120) NOT NULL DEFAULT 'Anonymous',
                "userId" INTEGER,
                "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Basic Hospital Table (for backward compatibility)
            CREATE TABLE IF NOT EXISTS "Hospital" (
                "id" SERIAL PRIMARY KEY,
                "name" VARCHAR NOT NULL,
                "doctorId" INTEGER,
                "bed" INTEGER DEFAULT 20,
                "room" INTEGER DEFAULT 10,
                "oxygenCylinder" INTEGER DEFAULT 15,
                "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Enterprise Hospital Intelligence Tables
            CREATE TABLE IF NOT EXISTS hospitals (
                id SERIAL PRIMARY KEY,
                hospital_code VARCHAR(30) UNIQUE,
                hospital_name VARCHAR(255) NOT NULL,
                hospital_type VARCHAR(50) DEFAULT 'MULTISPECIALITY',
                address TEXT,
                city VARCHAR(100),
                state VARCHAR(100),
                country VARCHAR(100) DEFAULT 'India',
                pincode VARCHAR(20),
                latitude NUMERIC(10, 7),
                longitude NUMERIC(10, 7),
                phone VARCHAR(50),
                email VARCHAR(100),
                website VARCHAR(255),
                rating NUMERIC(3, 2) DEFAULT 4.5,
                reliability_score NUMERIC(5, 2) DEFAULT 95.0,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS hospital_facilities (
                id SERIAL PRIMARY KEY,
                hospital_id INTEGER REFERENCES hospitals(id) ON DELETE CASCADE,
                facility_code VARCHAR(50) NOT NULL,
                facility_name VARCHAR(100) NOT NULL,
                facility_type VARCHAR(50) NOT NULL,
                is_available BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                UNIQUE (hospital_id, facility_code)
            );

            CREATE TABLE IF NOT EXISTS hospital_departments (
                id SERIAL PRIMARY KEY,
                hospital_id INTEGER REFERENCES hospitals(id) ON DELETE CASCADE,
                department_name VARCHAR(100) NOT NULL,
                is_active BOOLEAN DEFAULT TRUE,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS hospital_contacts (
                id SERIAL PRIMARY KEY,
                hospital_id INTEGER REFERENCES hospitals(id) ON DELETE CASCADE,
                contact_name VARCHAR(100),
                designation VARCHAR(100),
                phone VARCHAR(50),
                email VARCHAR(100),
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS hospital_admin_audit_logs (
                id SERIAL PRIMARY KEY,
                hospital_id INTEGER,
                actor_id INTEGER,
                action VARCHAR(100) NOT NULL,
                metadata JSONB,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Bed Booking Table
            CREATE TABLE IF NOT EXISTS "BedBooking" (
                "id" SERIAL PRIMARY KEY,
                "userId" INTEGER NOT NULL,
                "hospitalId" INTEGER,
                "hospitalPlaceId" VARCHAR,
                "hospitalName" VARCHAR NOT NULL,
                "bedsRequested" INTEGER NOT NULL DEFAULT 1,
                "contactName" VARCHAR,
                "contactNumber" VARCHAR,
                "notes" VARCHAR,
                "status" VARCHAR NOT NULL DEFAULT 'active',
                "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Diseases Encyclopedia Table
            CREATE TABLE IF NOT EXISTS "Disease" (
                "id" SERIAL PRIMARY KEY,
                "code" INTEGER UNIQUE,
                "name" VARCHAR NOT NULL,
                "common_name" VARCHAR,
                "category" VARCHAR DEFAULT 'General',
                "risk_level" VARCHAR DEFAULT 'Low',
                "transmission" VARCHAR,
                "symtom" VARCHAR,
                "solution" VARCHAR,
                "description" TEXT,
                "created_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                "updated_at" TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            -- Mobile Messaging & Activity Tables
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                sender_id VARCHAR(50),
                receiver_id VARCHAR(50),
                content TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS activities (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(50),
                description TEXT NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS diagnoses (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(50),
                symptoms TEXT NOT NULL,
                result JSONB NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS report_analyses (
                id SERIAL PRIMARY KEY,
                report_id VARCHAR(50),
                requested_by VARCHAR(50),
                result JSONB NOT NULL,
                created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS password_reset_requests (
                id SERIAL PRIMARY KEY,
                user_id VARCHAR(50),
                requested_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
                status VARCHAR(30) DEFAULT 'requested'
            );
        `;

        await pool.query(createTablesQuery);
        console.log("All tables checked/created successfully.");

        // 3. SEED INITIAL DISEASES IF EMPTY
        const diseaseCountRes = await pool.query('SELECT COUNT(*)::int as count FROM "Disease"');
        if (diseaseCountRes.rows[0].count === 0) {
            console.log("Seeding initial disease encyclopedia...");
            const sampleDiseases = [
                {
                    code: 101,
                    name: "Type 2 Diabetes Mellitus",
                    common_name: "Type 2 Diabetes",
                    category: "Chronic",
                    risk_level: "Medium",
                    transmission: "Non-communicable (Genetic & Lifestyle factors)",
                    symtom: "Increased thirst, frequent urination, fatigue, blurred vision, slow-healing sores",
                    solution: "Healthy low-glycemic diet, regular physical exercise, blood glucose monitoring, Metformin or prescribed medications.",
                    description: "A chronic metabolic condition characterized by insulin resistance and elevated blood glucose levels. Early detection and lifestyle changes can prevent severe vascular and renal complications."
                },
                {
                    code: 102,
                    name: "Hypertension",
                    common_name: "High Blood Pressure",
                    category: "Chronic",
                    risk_level: "High",
                    transmission: "Non-communicable (Lifestyle & Arterial stiffness)",
                    symtom: "Often asymptomatic ('silent killer'), severe headaches, chest discomfort, shortness of breath, dizziness",
                    solution: "DASH diet, low sodium intake, stress management, regular aerobic exercise, ACE inhibitors or beta-blockers as prescribed.",
                    description: "Persistent elevation of systemic arterial blood pressure (≥140/90 mmHg) that increases the risk of stroke, myocardial infarction, and chronic kidney disease."
                },
                {
                    code: 103,
                    name: "Dengue Fever",
                    common_name: "Breakbone Fever",
                    category: "Infectious",
                    risk_level: "High",
                    transmission: "Vector-borne via infected Aedes aegypti mosquitoes",
                    symtom: "Sudden high fever, intense retro-orbital headache, joint and muscle aches, rash, platelet count drop",
                    solution: "Bed rest, rigorous oral rehydration therapy, paracetamol for pain (avoid NSAIDs/Aspirin due to bleeding risk), platelet monitoring.",
                    description: "An acute arboviral infection endemic to tropical climates. Warning signs like persistent vomiting or mucosal bleeding require emergency hospitalization."
                },
                {
                    code: 104,
                    name: "Acute Bronchitis",
                    common_name: "Chest Cold",
                    category: "Infectious",
                    risk_level: "Low",
                    transmission: "Airborne respiratory droplets (primarily viral)",
                    symtom: "Hacking cough with or without clear/yellow sputum, sore throat, low-grade fever, mild chest soreness",
                    solution: "Humidified air, steam inhalation, throat lozenges, adequate hydration, rest; antibiotics usually not indicated unless secondary bacterial infection.",
                    description: "Short-term inflammation of the bronchial mucous membranes, commonly resolving within 10 to 14 days."
                },
                {
                    code: 105,
                    name: "Gastroesophageal Reflux Disease (GERD)",
                    common_name: "Acid Reflux / Heartburn",
                    category: "Lifestyle",
                    risk_level: "Low",
                    transmission: "Non-communicable (Lower esophageal sphincter dysfunction)",
                    symtom: "Burning retrosternal chest pain after eating, sour taste/acid regurgitation, chronic throat clearing, dysphagia",
                    solution: "Avoid lying down within 3 hours after meals, elevate head of bed, avoid trigger foods (acidic, fried, caffeine), antacids or PPIs.",
                    description: "A common digestive disease where stomach acid persistently flows back into the food pipe (esophagus), irritating the esophageal lining."
                },
                {
                    code: 106,
                    name: "Breast Cancer",
                    common_name: "Breast Neoplasm / Carcinoma",
                    category: "Oncology",
                    risk_level: "High",
                    transmission: "Non-communicable (Genetic mutations, BRCA1/2, hormonal factors)",
                    symtom: "Painless breast lump or thickening, skin dimpling, nipple inversion, nipple discharge, localized swelling or redness",
                    solution: "Early screening via mammography, surgical resection, chemotherapy, radiation therapy, hormone receptor targeted therapies.",
                    description: "Malignant cellular proliferation originating in breast tissue, most commonly inside milk ducts (ductal carcinoma) or lobules. Early detection significantly improves 5-year survival rates."
                },
                {
                    code: 107,
                    name: "Bronchial Asthma",
                    common_name: "Asthma",
                    category: "Chronic",
                    risk_level: "Medium",
                    transmission: "Non-communicable (Airway hyper-reactivity, environmental allergens)",
                    symtom: "Wheezing, episodic shortness of breath, chest tightness, nocturnal dry cough",
                    solution: "Inhaled corticosteroids (budesonide/fluticasone), short-acting bronchodilators (salbutamol) for rescue, avoiding dust/smoke triggers.",
                    description: "A chronic inflammatory disorder of the airways causing reversible bronchospasm, mucus hypersecretion, and airflow obstruction."
                },
                {
                    code: 108,
                    name: "COVID-19 (SARS-CoV-2)",
                    common_name: "Coronavirus Disease",
                    category: "Infectious",
                    risk_level: "Medium",
                    transmission: "Airborne aerosols and respiratory droplets",
                    symtom: "Fever, dry cough, fatigue, loss of taste or smell, sore throat, oxygen desaturation in severe cases",
                    solution: "Isolation, pulse oximetry monitoring, oral hydration, antipyretics, Paxlovid or monoclonal antibodies if high-risk, vaccination.",
                    description: "An acute contagious viral respiratory disease caused by the SARS-CoV-2 coronavirus with multisystemic inflammatory potential."
                },
                {
                    code: 109,
                    name: "Pulmonary Tuberculosis",
                    common_name: "TB",
                    category: "Infectious",
                    risk_level: "High",
                    transmission: "Airborne inhalation of Mycobacterium tuberculosis bacteria",
                    symtom: "Chronic cough lasting >3 weeks, hemoptysis (blood in sputum), night sweats, unexplained weight loss, low-grade fever",
                    solution: "Directly Observed Therapy (DOTS) multi-drug regimen: Isoniazid, Rifampicin, Pyrazinamide, Ethambutol for 6 months.",
                    description: "A bacterial infection primarily targeting lungs with granuloma formation. Completing the entire antibiotic course is critical to avoid multi-drug resistant strains."
                },
                {
                    code: 110,
                    name: "Malaria",
                    common_name: "Plasmodium Infection",
                    category: "Infectious",
                    risk_level: "High",
                    transmission: "Bite of infected female Anopheles mosquitoes",
                    symtom: "High cyclical fever with rigor and chills, profuse sweating, headache, nausea, anemia, jaundice",
                    solution: "Artemisinin-based combination therapies (ACT), chloroquine, insect repellent, bed nets, prompt blood smear confirmation.",
                    description: "A protozoan parasitic disease that infects and ruptures red blood cells, potentially causing cerebral malaria if left untreated."
                },
                {
                    code: 111,
                    name: "Migraine",
                    common_name: "Severe Throbbing Headache",
                    category: "Neurology",
                    risk_level: "Low",
                    transmission: "Non-communicable (Neurovascular trigeminal activation)",
                    symtom: "Unilateral pulsating headache, photophobia, phonophobia, nausea, visual aura",
                    solution: "Triptans, NSAIDs, dark quiet room rest, hydration, preventive CGRP antagonists or beta-blockers.",
                    description: "A complex neurovascular disorder characterized by recurrent moderate to severe throbbing headaches lasting 4 to 72 hours."
                },
                {
                    code: 112,
                    name: "Rheumatoid Arthritis",
                    common_name: "Inflammatory Joint Disease",
                    category: "Chronic",
                    risk_level: "Medium",
                    transmission: "Autoimmune disorder (Genetic predisposition)",
                    symtom: "Symmetrical joint pain, morning stiffness >30 minutes, joint swelling in hands/wrists, fatigue",
                    solution: "DMARDs (Methotrexate), biologic response modifiers, low-impact exercise, joint protection strategies.",
                    description: "A chronic systemic autoimmune disease causing progressive synovial inflammation, joint erosion, and functional impairment."
                },
                {
                    code: 113,
                    name: "Hypothyroidism",
                    common_name: "Underactive Thyroid",
                    category: "Chronic",
                    risk_level: "Low",
                    transmission: "Non-communicable (Autoimmune Hashimoto's / Iodine deficiency)",
                    symtom: "Weight gain, cold intolerance, fatigue, dry skin, constipation, bradycardia, hair thinning",
                    solution: "Daily synthetic Levothyroxine (T4) replacement on an empty stomach, periodic TSH level testing.",
                    description: "A hormonal deficiency resulting from underproduction of thyroid hormones by the thyroid gland, slowing basal metabolism."
                },
                {
                    code: 114,
                    name: "Renal Calculi (Nephrolithiasis)",
                    common_name: "Kidney Stones",
                    category: "Lifestyle",
                    risk_level: "Medium",
                    transmission: "Non-communicable (Dehydration, high oxalate / uric acid precipitation)",
                    symtom: "Severe flank pain radiating to groin (renal colic), hematuria (blood in urine), dysuria, nausea",
                    solution: "High water intake (>3L/day), pain management (NSAIDs), alpha-blockers for stone passage, lithotripsy for large stones.",
                    description: "Solid mineral crystalline deposits that form inside the renal pelvis and ureters causing acute obstruction and spasms."
                }
            ];

            for (const d of sampleDiseases) {
                await pool.query(
                    `INSERT INTO "Disease" (code, name, common_name, category, risk_level, transmission, symtom, solution, description)
                     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
                     ON CONFLICT (code) DO UPDATE SET
                        name = EXCLUDED.name,
                        common_name = EXCLUDED.common_name,
                        category = EXCLUDED.category,
                        risk_level = EXCLUDED.risk_level,
                        transmission = EXCLUDED.transmission,
                        symtom = EXCLUDED.symtom,
                        solution = EXCLUDED.solution,
                        description = EXCLUDED.description`,
                    [d.code, d.name, d.common_name, d.category, d.risk_level, d.transmission, d.symtom, d.solution, d.description]
                );
            }
            console.log("Comprehensive diseases seeded successfully.");
        }

    } catch (e) {
        console.error("Error during database seeding:", e);
        throw e; 
    }
}
