from backend.database import SessionLocal
from backend.models import Company

def main():
    # SessionLocal is synchronous, so we use a standard 'with' block
    with SessionLocal() as db:
        companies = db.query(Company).all()
        for c in companies:
            print(f"Company: {c.name}")
            print(f"  worklog_definitions: {c.worklog_definitions}")
            print(f"  settings: {c.settings}")

if __name__ == "__main__":
    main()
