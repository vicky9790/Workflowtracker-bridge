const { badRequest } = require('../utils/errors');

/**
 * validate({ body, query, params }) - each key is an optional zod schema.
 * On success, req.body/query/params are replaced with the parsed (and
 * therefore coerced/defaulted) values. On failure, throws a 400 with the
 * field-level issues attached so the Agent/admin UI can show them.
 */
function validate(schemas) {
  return function runValidation(req, res, next) {
    try {
      if (schemas.body) req.body = schemas.body.parse(req.body);
      if (schemas.query) req.query = schemas.query.parse(req.query);
      if (schemas.params) req.params = schemas.params.parse(req.params);
      next();
    } catch (err) {
      const details = err.issues
        ? err.issues.map((i) => ({ path: i.path.join('.'), message: i.message }))
        : undefined;
      next(badRequest('Request validation failed', details));
    }
  };
}

module.exports = { validate };
