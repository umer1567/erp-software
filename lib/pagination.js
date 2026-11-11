export function getPagination(searchParams) {
  const page = Math.max(
    Number(searchParams.get("page") || 1),
    1
  );

  const limit = Math.min(
    Math.max(
      Number(searchParams.get("limit") || 20),
      1
    ),
    100
  );

  const offset = (page - 1) * limit;

  return {
    page,
    limit,
    offset,
  };
}

export function createPagination({
  page,
  limit,
  total,
}) {
  return {
    page,
    limit,
    total,
    totalPages: Math.ceil(total / limit),
    hasNextPage: page < Math.ceil(total / limit),
    hasPreviousPage: page > 1,
  };
}