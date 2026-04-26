from fastapi import Depends, HTTPException, status

from app.api.deps import get_current_user
from app.models.user import User


def require_role(*roles: str):
    def dependency(current_user: User = Depends(get_current_user)) -> User:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="No tiene permisos para esta acción.",
            )
        return current_user

    return dependency


require_tesorero = require_role("tesorero")
require_tesorero_or_equipo = require_role("tesorero", "equipo_tesoreria")
require_approver = require_role("tesorero", "superintendente")
