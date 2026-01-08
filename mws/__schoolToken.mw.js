module.exports = ({ meta, config, managers }) => {
    return ({ req, res, next }) => {
        if (!req.headers.token) {
            return managers.responseDispatcher.dispatch(res, {
                ok: false,
                code: 401,
                errors: 'unauthorized'
            });
        }

        let decoded = null;
        try {
            decoded = managers.token.verifyShortToken({ token: req.headers.token });
            if (!decoded) {
                return managers.responseDispatcher.dispatch(res, {
                    ok: false,
                    code: 401,
                    errors: 'invalid or expired token'
                });
            }
        } catch (err) {
            return managers.responseDispatcher.dispatch(res, {
                ok: false,
                code: 401,
                errors: 'invalid or expired token'
            });
        }

        next({
            userId: decoded.userId,
            userKey: decoded.userKey,
            role: decoded.role,
            schoolId: decoded.schoolId,
            sessionId: decoded.sessionId,
            deviceId: decoded.deviceId
        });
    }
}
