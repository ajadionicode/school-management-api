module.exports = ({ meta, config, managers }) => {
    return ({ req, res, next, results }) => {
        const tokenData = results.__schoolToken;

        if (!tokenData) {
            return managers.responseDispatcher.dispatch(res, {
                ok: false,
                code: 401,
                errors: 'unauthorized'
            });
        }

        // Superadmins can also access school admin routes
        if (tokenData.role === 'superadmin') {
            // For superadmins, schoolId must be provided in request body or query
            const requestSchoolId = req.body.schoolId || req.query.schoolId || req.body.id || req.query.id;
            if (!requestSchoolId) {
                return managers.responseDispatcher.dispatch(res, {
                    ok: false,
                    code: 400,
                    errors: 'schoolId is required for superadmin to access school resources'
                });
            }
            next({
                schoolId: requestSchoolId,
                role: 'superadmin',
                userId: tokenData.userId
            });
            return;
        }

        if (tokenData.role !== 'school_admin') {
            return managers.responseDispatcher.dispatch(res, {
                ok: false,
                code: 403,
                errors: 'forbidden - school admin access required'
            });
        }

        // For school admins, use their assigned schoolId
        if (!tokenData.schoolId) {
            return managers.responseDispatcher.dispatch(res, {
                ok: false,
                code: 403,
                errors: 'school admin is not assigned to any school'
            });
        }

        next({
            schoolId: tokenData.schoolId,
            role: 'school_admin',
            userId: tokenData.userId
        });
    }
}
