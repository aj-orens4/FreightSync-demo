function ok(res, data, meta = null, statusCode = 200) {
  const body = { success: true, data };
  if (meta) body.meta = meta;
  return res.status(statusCode).json(body);
}

function created(res, data) {
  return ok(res, data, null, 201);
}

function fail(res, message, statusCode = 400, errors = []) {
  return res.status(statusCode).json({ success: false, message, errors });
}

function notFound(res, entity = 'Resource') {
  return fail(res, `${entity} not found`, 404);
}

module.exports = { ok, created, fail, notFound };
