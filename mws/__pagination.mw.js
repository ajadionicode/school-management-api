module.exports = ({ meta, config, managers }) => {
    return ({ req, res, next }) => {
        const page = Math.max(1, parseInt(req.query.page) || 1);
        const limit = Math.min(Math.max(1, parseInt(req.query.limit) || 10), 100);
        const skip = (page - 1) * limit;
        const sortField = req.query.sortBy || 'createdAt';
        const sortOrder = req.query.sortOrder === 'asc' ? 1 : -1;
        const sort = { [sortField]: sortOrder };

        next({
            page,
            limit,
            skip,
            sort,
            sortField,
            sortOrder
        });
    }
}
