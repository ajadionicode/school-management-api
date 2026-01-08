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

        if (tokenData.role !== 'superadmin') {
            return managers.responseDispatcher.dispatch(res, {
                ok: false,
                code: 403,
                errors: 'forbidden - superadmin access required'
            });
        }

        next({
            userId: tokenData.userId,
            role: tokenData.role,
            isSuperadmin: true
        });
    }
}
