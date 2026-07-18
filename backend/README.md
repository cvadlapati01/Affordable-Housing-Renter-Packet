# RealDoor backend

Offline FastAPI backend for the RealDoor affordable-housing application-readiness challenge.

## Safety boundary

The API prepares a renter-controlled packet from synthetic documents. It never determines eligibility, approval, denial, priority, ranking, vacancy, rent, or waitlist status.

## Local setup

1. Obtain the organizer-approved starter pack separately and place it next to this `backend/` directory as `realdoor-hackathon-starter-pack/`. It is intentionally excluded from this repository until its distribution terms are approved.
2. Create a Python 3.12 virtual environment inside `backend/` and install `requirements.txt`.
3. Run:

   ```powershell
   .\.venv\Scripts\python.exe -m uvicorn app.main:app --host 127.0.0.1 --port 8001
   ```

4. Open `http://127.0.0.1:8001/docs`.

See `API_CONTRACT.md` for the Lovable integration contract.
