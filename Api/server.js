const crypto = require("crypto");
const express = require("express");
const postgres = require("postgres");
const swaggerUi = require("swagger-ui-express");
const z = require("zod");

const swaggerSpec = require("./swagger");

const app = express();
const port = 8000;
const sql = postgres({
  db: process.env.PGDATABASE ?? "mydb",
  user: process.env.PGUSER ?? "user",
  password: process.env.PGPASSWORD ?? "password",
  port: process.env.PGPORT ?? "5433",
});
const freeToGameBaseUrl = "https://www.freetogame.com/api";

app.use(express.json());

// Schemas
const ProductSchema = z.object({
  id: z.string(),
  name: z.string(),
  about: z.string(),
  price: z.number().positive(),
});
const CreateProductSchema = ProductSchema.omit({ id: true });

const ProductSearchSchema = z.object({
  name: z.string().trim().min(1).optional(),
  about: z.string().trim().min(1).optional(),
  price: z.coerce.number().positive().optional(),
});

const OrderProductIdsSchema = z.array(z.coerce.number().int().positive()).min(1);

const CreateUserSchema = z.object({
  username: z.string().trim().min(1).max(100),
  email: z.email().max(255),
  password: z.string().min(1),
});

const UpdateUserSchema = CreateUserSchema;

const PatchUserSchema = z
  .object({
    username: z.string().trim().min(1).max(100).optional(),
    email: z.email().max(255).optional(),
    password: z.string().min(1).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

const CreateOrderSchema = z.object({
  userId: z.coerce.number().int().positive(),
  productIds: OrderProductIdsSchema,
  payment: z.boolean().optional(),
});

const UpdateOrderSchema = z.object({
  userId: z.coerce.number().int().positive(),
  productIds: OrderProductIdsSchema,
  payment: z.boolean(),
});

const PatchOrderSchema = z
  .object({
    userId: z.coerce.number().int().positive().optional(),
    productIds: OrderProductIdsSchema.optional(),
    payment: z.boolean().optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

const CreateReviewSchema = z.object({
  userId: z.coerce.number().int().positive(),
  productId: z.coerce.number().int().positive(),
  score: z.coerce.number().int().min(1).max(5),
  content: z.string().trim().min(1).optional(),
});

const UpdateReviewSchema = z.object({
  userId: z.coerce.number().int().positive(),
  productId: z.coerce.number().int().positive(),
  score: z.coerce.number().int().min(1).max(5),
  content: z.string().trim().min(1).optional(),
});

const PatchReviewSchema = z
  .object({
    userId: z.coerce.number().int().positive().optional(),
    productId: z.coerce.number().int().positive().optional(),
    score: z.coerce.number().int().min(1).max(5).optional(),
    content: z.string().trim().min(1).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "At least one field must be provided",
  });

const ReviewSearchSchema = z.object({
  userId: z.coerce.number().int().positive().optional(),
  productId: z.coerce.number().int().positive().optional(),
});

function hashPassword(password) {
  return crypto.createHash("sha512").update(password).digest("hex");
}

// Assemble une clause WHERE à partir de fragments sql conditions reliés par AND.
// (postgres.js n'expose pas sql.join, on compose des fragments imbriqués.)
function buildWhere(conditions) {
  return conditions.reduce(
    (acc, condition, index) =>
      index === 0 ? sql`WHERE ${condition}` : sql`${acc} AND ${condition}`,
    sql``
  );
}

function formatZodError(error) {
  return {
    message: "Invalid request body",
    errors: z.flattenError(error),
  };
}

function parseId(value) {
  const id = Number.parseInt(value, 10);
  return Number.isInteger(id) && id > 0 ? id : null;
}

function isUniqueViolation(error) {
  return error && error.code === "23505";
}

function uniqueViolationMessage(error) {
  if (error.constraint_name === "users_username_key") {
    return "Username already exists";
  }

  if (error.constraint_name === "users_email_key") {
    return "Email already exists";
  }

  return "Unique constraint violation";
}

async function fetchJson(url) {
  const response = await fetch(url);

  if (!response.ok) {
    const error = new Error(`Upstream service returned ${response.status}`);
    error.status = response.status;
    throw error;
  }

  return response.json();
}

async function findUserById(id) {
  const users = await sql`
    SELECT id, username, email
    FROM users
    WHERE id=${id}
  `;

  return users[0] ?? null;
}

async function findProductsByIds(productIds) {
  const products = await sql`
    SELECT id, name, about, price
    FROM products
    WHERE id = ANY(${productIds})
  `;

  const productsById = new Map(products.map((product) => [product.id, product]));
  return productIds.map((productId) => productsById.get(productId) ?? null);
}

async function findProductById(id) {
  const products = await sql`
    SELECT id, name, about, price, review_ids AS "reviewIds", score
    FROM products
    WHERE id=${id}
  `;

  return products[0] ?? null;
}

const reviewColumns = sql`
  id,
  user_id AS "userId",
  product_id AS "productId",
  score,
  content,
  created_at AS "createdAt",
  updated_at AS "updatedAt"
`;

async function findReviewsByProductId(productId) {
  return sql`
    SELECT ${reviewColumns}
    FROM reviews
    WHERE product_id=${productId}
    ORDER BY id
  `;
}

// Recalcule les ids des reviews et le score moyen du produit à partir
// des avis existants. Appelé après chaque création/modification/suppression.
async function recomputeProductReviews(productId) {
  const reviews = await sql`
    SELECT id, score
    FROM reviews
    WHERE product_id=${productId}
    ORDER BY id
  `;

  const reviewIds = reviews.map((review) => review.id);
  const score =
    reviews.length > 0
      ? Number(
          (reviews.reduce((sum, review) => sum + review.score, 0) / reviews.length).toFixed(2)
        )
      : null;

  await sql`
    UPDATE products
    SET review_ids=${reviewIds}, score=${score}
    WHERE id=${productId}
  `;
}

async function validateReviewPayload(userId, productId) {
  const user = await findUserById(userId);

  if (!user) {
    return { error: { status: 404, message: "User not found" } };
  }

  const product = await findProductById(productId);

  if (!product) {
    return { error: { status: 404, message: "Product not found" } };
  }

  return { user, product };
}

function calculateOrderTotal(products) {
  const subtotal = products.reduce((sum, product) => sum + Number(product.price), 0);
  return Number((subtotal * 1.2).toFixed(2));
}

async function validateOrderPayload(userId, productIds) {
  const user = await findUserById(userId);

  if (!user) {
    return { error: { status: 404, message: "User not found" } };
  }

  const products = await findProductsByIds(productIds);
  const hasMissingProduct = products.some((product) => product === null);

  if (hasMissingProduct) {
    return { error: { status: 404, message: "One or more products were not found" } };
  }

  return {
    user,
    products,
    total: calculateOrderTotal(products),
  };
}

function mapOrder(order, user, products) {
  return {
    id: order.id,
    userId: order.userId,
    productIds: order.productIds,
    total: Number(order.total),
    payment: order.payment,
    createdAt: order.createdAt,
    updatedAt: order.updatedAt,
    user,
    products,
  };
}

async function hydrateOrder(order) {
  const user = await findUserById(order.userId);
  const products = await findProductsByIds(order.productIds);

  return mapOrder(order, user, products.filter((product) => product !== null));
}

app.post("/products", async (req, res) => {
  const result = await CreateProductSchema.safeParse(req.body);

  // If Zod parsed successfully the request body
  if (result.success) {
    const { name, about, price } = result.data;

    const product = await sql`
    INSERT INTO products (name, about, price)
    VALUES (${name}, ${about}, ${price})
    RETURNING *
    `;

    res.send(product[0]);
  } else {
    res.status(400).send(result);
  }
});

app.get("/products", async (req, res) => {
  const result = ProductSearchSchema.safeParse(req.query);

  if (!result.success) {
    return res.status(400).send(formatZodError(result.error));
  }

  const { name, about, price } = result.data;
  const filters = [];

  if (name) {
    filters.push(sql`name ILIKE ${`%${name}%`}`);
  }

  if (about) {
    filters.push(sql`about ILIKE ${`%${about}%`}`);
  }

  if (price !== undefined) {
    filters.push(sql`price <= ${price}`);
  }

  const whereClause = buildWhere(filters);

  const products = await sql`
    SELECT *
    FROM products
    ${whereClause}
    ORDER BY id
  `;

  res.send(products);
});

app.get("/products/:id", async (req, res) => {
  const product = await sql`
    SELECT * FROM products WHERE id=${req.params.id}
    `;

  if (product.length > 0) {
    const reviews = await findReviewsByProductId(product[0].id);
    res.send({ ...product[0], reviews });
  } else {
    res.status(404).send({ message: "Not found" });
  }
});

app.delete("/products/:id", async (req, res) => {
  const product = await sql`
    DELETE FROM products
    WHERE id=${req.params.id}
    RETURNING *
    `;

  if (product.length > 0) {
    res.send(product[0]);
  } else {
    res.status(404).send({ message: "Not found" });
  }
});

app.post("/users", async (req, res) => {
  const result = CreateUserSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).send(formatZodError(result.error));
  }

  const { username, email, password } = result.data;

  try {
    const users = await sql`
      INSERT INTO users (username, email, password)
      VALUES (${username}, ${email}, ${hashPassword(password)})
      RETURNING id, username, email
    `;

    return res.status(201).send(users[0]);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return res.status(409).send({ message: uniqueViolationMessage(error) });
    }

    throw error;
  }
});

app.get("/users", async (_req, res) => {
  const users = await sql`
    SELECT id, username, email
    FROM users
    ORDER BY id
  `;

  res.send(users);
});

app.get("/users/:id", async (req, res) => {
  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).send({ message: "Invalid user id" });
  }

  const users = await sql`
    SELECT id, username, email
    FROM users
    WHERE id=${id}
  `;

  if (users.length === 0) {
    return res.status(404).send({ message: "User not found" });
  }

  return res.send(users[0]);
});

app.post("/orders", async (req, res) => {
  const result = CreateOrderSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).send(formatZodError(result.error));
  }

  const { userId, productIds, payment = false } = result.data;
  const validation = await validateOrderPayload(userId, productIds);

  if (validation.error) {
    return res.status(validation.error.status).send({ message: validation.error.message });
  }

  const orders = await sql`
    INSERT INTO orders (user_id, product_ids, total, payment)
    VALUES (
      ${userId},
      ${productIds},
      ${validation.total},
      ${payment}
    )
    RETURNING
      id,
      user_id AS "userId",
      product_ids AS "productIds",
      total,
      payment,
      created_at AS "createdAt",
      updated_at AS "updatedAt"
  `;

  return res.status(201).send(mapOrder(orders[0], validation.user, validation.products));
});

app.get("/orders", async (_req, res) => {
  const orders = await sql`
    SELECT
      id,
      user_id AS "userId",
      product_ids AS "productIds",
      total,
      payment,
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM orders
    ORDER BY id
  `;

  const hydratedOrders = await Promise.all(orders.map(hydrateOrder));
  return res.send(hydratedOrders);
});

app.get("/orders/:id", async (req, res) => {
  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).send({ message: "Invalid order id" });
  }

  const orders = await sql`
    SELECT
      id,
      user_id AS "userId",
      product_ids AS "productIds",
      total,
      payment,
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM orders
    WHERE id=${id}
  `;

  if (orders.length === 0) {
    return res.status(404).send({ message: "Order not found" });
  }

  return res.send(await hydrateOrder(orders[0]));
});

app.get("/f2p-games", async (_req, res, next) => {
  try {
    const games = await fetchJson(`${freeToGameBaseUrl}/games`);
    return res.send(games);
  } catch (error) {
    if (error.status) {
      return res.status(502).send({ message: "FreeToGame service is unavailable" });
    }

    return next(error);
  }
});

app.get("/f2p-games/:id", async (req, res, next) => {
  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).send({ message: "Invalid game id" });
  }

  try {
    const game = await fetchJson(`${freeToGameBaseUrl}/game?id=${id}`);
    return res.send(game);
  } catch (error) {
    if (error.status === 404) {
      return res.status(404).send({ message: "Game not found" });
    }

    if (error.status) {
      return res.status(502).send({ message: "FreeToGame service is unavailable" });
    }

    return next(error);
  }
});

app.put("/orders/:id", async (req, res) => {
  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).send({ message: "Invalid order id" });
  }

  const result = UpdateOrderSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).send(formatZodError(result.error));
  }

  const { userId, productIds, payment } = result.data;
  const validation = await validateOrderPayload(userId, productIds);

  if (validation.error) {
    return res.status(validation.error.status).send({ message: validation.error.message });
  }

  const orders = await sql`
    UPDATE orders
    SET
      user_id=${userId},
      product_ids=${productIds},
      total=${validation.total},
      payment=${payment},
      updated_at=NOW()
    WHERE id=${id}
    RETURNING
      id,
      user_id AS "userId",
      product_ids AS "productIds",
      total,
      payment,
      created_at AS "createdAt",
      updated_at AS "updatedAt"
  `;

  if (orders.length === 0) {
    return res.status(404).send({ message: "Order not found" });
  }

  return res.send(mapOrder(orders[0], validation.user, validation.products));
});

app.put("/users/:id", async (req, res) => {
  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).send({ message: "Invalid user id" });
  }

  const result = UpdateUserSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).send(formatZodError(result.error));
  }

  const { username, email, password } = result.data;

  try {
    const users = await sql`
      UPDATE users
      SET
        username=${username},
        email=${email},
        password=${hashPassword(password)}
      WHERE id=${id}
      RETURNING id, username, email
    `;

    if (users.length === 0) {
      return res.status(404).send({ message: "User not found" });
    }

    return res.send(users[0]);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return res.status(409).send({ message: uniqueViolationMessage(error) });
    }

    throw error;
  }
});

app.patch("/orders/:id", async (req, res) => {
  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).send({ message: "Invalid order id" });
  }

  const result = PatchOrderSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).send(formatZodError(result.error));
  }

  const existingOrders = await sql`
    SELECT
      id,
      user_id AS "userId",
      product_ids AS "productIds",
      total,
      payment,
      created_at AS "createdAt",
      updated_at AS "updatedAt"
    FROM orders
    WHERE id=${id}
  `;

  if (existingOrders.length === 0) {
    return res.status(404).send({ message: "Order not found" });
  }

  const existingOrder = existingOrders[0];
  const userId = result.data.userId ?? existingOrder.userId;
  const productIds = result.data.productIds ?? existingOrder.productIds;
  const payment = result.data.payment ?? existingOrder.payment;
  const validation = await validateOrderPayload(userId, productIds);

  if (validation.error) {
    return res.status(validation.error.status).send({ message: validation.error.message });
  }

  const orders = await sql`
    UPDATE orders
    SET
      user_id=${userId},
      product_ids=${productIds},
      total=${validation.total},
      payment=${payment},
      updated_at=NOW()
    WHERE id=${id}
    RETURNING
      id,
      user_id AS "userId",
      product_ids AS "productIds",
      total,
      payment,
      created_at AS "createdAt",
      updated_at AS "updatedAt"
  `;

  return res.send(mapOrder(orders[0], validation.user, validation.products));
});

app.patch("/users/:id", async (req, res) => {
  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).send({ message: "Invalid user id" });
  }

  const result = PatchUserSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).send(formatZodError(result.error));
  }

  const updates = result.data;
  const query = {
    username: updates.username,
    email: updates.email,
    password: updates.password ? hashPassword(updates.password) : undefined,
    id,
  };

  try {
    const users = await sql`
      UPDATE users
      SET
        username=COALESCE(${query.username}, username),
        email=COALESCE(${query.email}, email),
        password=COALESCE(${query.password}, password)
      WHERE id=${query.id}
      RETURNING id, username, email
    `;

    if (users.length === 0) {
      return res.status(404).send({ message: "User not found" });
    }

    return res.send(users[0]);
  } catch (error) {
    if (isUniqueViolation(error)) {
      return res.status(409).send({ message: uniqueViolationMessage(error) });
    }

    throw error;
  }
});

app.delete("/orders/:id", async (req, res) => {
  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).send({ message: "Invalid order id" });
  }

  const orders = await sql`
    DELETE FROM orders
    WHERE id=${id}
    RETURNING
      id,
      user_id AS "userId",
      product_ids AS "productIds",
      total,
      payment,
      created_at AS "createdAt",
      updated_at AS "updatedAt"
  `;

  if (orders.length === 0) {
    return res.status(404).send({ message: "Order not found" });
  }

  return res.send(await hydrateOrder(orders[0]));
});

app.delete("/users/:id", async (req, res) => {
  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).send({ message: "Invalid user id" });
  }

  const users = await sql`
    DELETE FROM users
    WHERE id=${id}
    RETURNING id, username, email
  `;

  if (users.length === 0) {
    return res.status(404).send({ message: "User not found" });
  }

  return res.send(users[0]);
});

app.post("/reviews", async (req, res) => {
  const result = CreateReviewSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).send(formatZodError(result.error));
  }

  const { userId, productId, score, content } = result.data;
  const validation = await validateReviewPayload(userId, productId);

  if (validation.error) {
    return res.status(validation.error.status).send({ message: validation.error.message });
  }

  const reviews = await sql`
    INSERT INTO reviews (user_id, product_id, score, content)
    VALUES (${userId}, ${productId}, ${score}, ${content ?? null})
    RETURNING ${reviewColumns}
  `;

  await recomputeProductReviews(productId);

  return res.status(201).send(reviews[0]);
});

app.get("/reviews", async (req, res) => {
  const result = ReviewSearchSchema.safeParse(req.query);

  if (!result.success) {
    return res.status(400).send(formatZodError(result.error));
  }

  const { userId, productId } = result.data;
  const filters = [];

  if (userId !== undefined) {
    filters.push(sql`user_id=${userId}`);
  }

  if (productId !== undefined) {
    filters.push(sql`product_id=${productId}`);
  }

  const whereClause = buildWhere(filters);

  const reviews = await sql`
    SELECT ${reviewColumns}
    FROM reviews
    ${whereClause}
    ORDER BY id
  `;

  return res.send(reviews);
});

app.get("/reviews/:id", async (req, res) => {
  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).send({ message: "Invalid review id" });
  }

  const reviews = await sql`
    SELECT ${reviewColumns}
    FROM reviews
    WHERE id=${id}
  `;

  if (reviews.length === 0) {
    return res.status(404).send({ message: "Review not found" });
  }

  return res.send(reviews[0]);
});

app.put("/reviews/:id", async (req, res) => {
  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).send({ message: "Invalid review id" });
  }

  const result = UpdateReviewSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).send(formatZodError(result.error));
  }

  const existing = await sql`SELECT product_id AS "productId" FROM reviews WHERE id=${id}`;

  if (existing.length === 0) {
    return res.status(404).send({ message: "Review not found" });
  }

  const { userId, productId, score, content } = result.data;
  const validation = await validateReviewPayload(userId, productId);

  if (validation.error) {
    return res.status(validation.error.status).send({ message: validation.error.message });
  }

  const reviews = await sql`
    UPDATE reviews
    SET
      user_id=${userId},
      product_id=${productId},
      score=${score},
      content=${content ?? null},
      updated_at=NOW()
    WHERE id=${id}
    RETURNING ${reviewColumns}
  `;

  // Le produit peut avoir changé : recalculer l'ancien et le nouveau.
  await recomputeProductReviews(existing[0].productId);
  if (existing[0].productId !== productId) {
    await recomputeProductReviews(productId);
  }

  return res.send(reviews[0]);
});

app.patch("/reviews/:id", async (req, res) => {
  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).send({ message: "Invalid review id" });
  }

  const result = PatchReviewSchema.safeParse(req.body);

  if (!result.success) {
    return res.status(400).send(formatZodError(result.error));
  }

  const existingReviews = await sql`
    SELECT ${reviewColumns}
    FROM reviews
    WHERE id=${id}
  `;

  if (existingReviews.length === 0) {
    return res.status(404).send({ message: "Review not found" });
  }

  const existing = existingReviews[0];
  const userId = result.data.userId ?? existing.userId;
  const productId = result.data.productId ?? existing.productId;
  const score = result.data.score ?? existing.score;
  const content = result.data.content ?? existing.content;
  const validation = await validateReviewPayload(userId, productId);

  if (validation.error) {
    return res.status(validation.error.status).send({ message: validation.error.message });
  }

  const reviews = await sql`
    UPDATE reviews
    SET
      user_id=${userId},
      product_id=${productId},
      score=${score},
      content=${content ?? null},
      updated_at=NOW()
    WHERE id=${id}
    RETURNING ${reviewColumns}
  `;

  await recomputeProductReviews(existing.productId);
  if (existing.productId !== productId) {
    await recomputeProductReviews(productId);
  }

  return res.send(reviews[0]);
});

app.delete("/reviews/:id", async (req, res) => {
  const id = parseId(req.params.id);

  if (!id) {
    return res.status(400).send({ message: "Invalid review id" });
  }

  const reviews = await sql`
    DELETE FROM reviews
    WHERE id=${id}
    RETURNING ${reviewColumns}
  `;

  if (reviews.length === 0) {
    return res.status(404).send({ message: "Review not found" });
  }

  await recomputeProductReviews(reviews[0].productId);

  return res.send(reviews[0]);
});

app.use("/api-docs", swaggerUi.serve, swaggerUi.setup(swaggerSpec));

app.get("/", (req, res) => {
  res.send("Hello World!");
});

app.use((error, _req, res, _next) => {
  console.error(error);
  res.status(500).send({ message: "Internal server error" });
});

app.listen(port, () => {
  console.log(`Listening on http://localhost:${port}`);
});
