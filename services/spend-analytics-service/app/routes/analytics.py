from fastapi import APIRouter, Depends, Query
from pymongo.database import Database

from app.db import get_db
from app.models.schemas import Overview
from app.services import analytics_service as svc

router = APIRouter(prefix="/api/analytics", tags=["analytics"])


@router.get("/overview", response_model=Overview)
def overview(db: Database = Depends(get_db)):
    return svc.overview(db)


@router.get("/departments")
def departments(db: Database = Depends(get_db)):
    return svc.departments(db)


@router.get("/categories")
def categories(db: Database = Depends(get_db)):
    return svc.categories(db)


@router.get("/suppliers")
def suppliers(db: Database = Depends(get_db)):
    return svc.suppliers(db)


@router.get("/monthly")
def monthly(db: Database = Depends(get_db)):
    return svc.monthly(db)


@router.get("/anomalies")
def anomalies(db: Database = Depends(get_db)):
    return svc.anomalies(db)


@router.get("/alerts")
def alerts(db: Database = Depends(get_db)):
    return svc.alerts(db)


@router.get("/events")
def events(limit: int = Query(25, ge=1, le=200), db: Database = Depends(get_db)):
    return svc.recent_events(db, limit)
