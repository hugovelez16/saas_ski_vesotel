from database import SessionLocal
import main
import crud
import auth

db = SessionLocal()
user = db.query(crud.models.User).filter(crud.models.User.role == "user").first()
if user:
    try:
        logs = main.read_work_logs(skip=0, limit=10, db=db, current_user=user)
        print("Success! User logs count:", len(logs))
    except Exception as e:
        import traceback
        traceback.print_exc()
else:
    print("No non-admin user found")
