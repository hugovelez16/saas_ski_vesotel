from database import SessionLocal
import crud
import schemas

db = SessionLocal()
work_logs = crud.get_work_logs(db, limit=1)

if work_logs:
    try:
        # Simulate Pydantic response validation
        resp = schemas.WorkLogResponse.model_validate(work_logs[0])
        print("Success! Log ID:", resp.id)
    except Exception as e:
        import traceback
        traceback.print_exc()
else:
    print("No logs found.")
