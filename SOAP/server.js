const soap = require("soap");
const fs = require("node:fs");
const http = require("http");
const postgres = require("postgres");

const sql = postgres({ db: "mydb", user: "user", password: "password", port: "5435" });

// Construit une Fault SOAP avec un code et un statut HTTP donnés.
function soapFault(reason, statusCode, subcode) {
  return {
    Fault: {
      Code: {
        Value: "soap:Sender",
        Subcode: { value: subcode },
      },
      Reason: { Text: reason },
      statusCode,
    },
  };
}

// Define the service implementation
const service = {
  ProductsService: {
    ProductsPort: {
            CreateProduct: async function ({ name, about, price }, callback) {
        if (!name || !about || !price) {
          throw {
            Fault: {
              Code: {
                Value: "soap:Sender",
                Subcode: { value: "rpc:BadArguments" },
              },
              Reason: { Text: "Processing Error" },
              statusCode: 400,
            },
          };
        }

        const product = await sql`
          INSERT INTO products (name, about, price)
          VALUES (${name}, ${about}, ${price})
          RETURNING *
          `;

        // Will return only one element.
        callback(product[0]);
      },

      // Exercice : renvoie tous les produits présents en base.
      GetProducts: async function () {
        const products = await sql`
          SELECT id, name, about, price
          FROM products
          ORDER BY id
        `;

        return { products };
      },

      // Exercice : met à jour partiellement un produit grâce à son id.
      PatchProduct: async function ({ id, name, about, price }) {
        if (!id) {
          throw soapFault("Missing product id", 400, "rpc:BadArguments");
        }

        const products = await sql`
          UPDATE products
          SET
            name=COALESCE(${name ?? null}, name),
            about=COALESCE(${about ?? null}, about),
            price=COALESCE(${price ?? null}::float, price)
          WHERE id=${id}
          RETURNING *
        `;

        if (products.length === 0) {
          throw soapFault("Product not found", 404, "rpc:NotFound");
        }

        return products[0];
      },

      // Exercice : supprime un produit grâce à son id.
      DeleteProduct: async function ({ id }) {
        if (!id) {
          throw soapFault("Missing product id", 400, "rpc:BadArguments");
        }

        const products = await sql`
          DELETE FROM products
          WHERE id=${id}
          RETURNING *
        `;

        if (products.length === 0) {
          throw soapFault("Product not found", 404, "rpc:NotFound");
        }

        return products[0];
      },
    },
  },
};

// http server example
const server = http.createServer(function (request, response) {
  response.end("404: Not Found: " + request.url);
});
 
server.listen(8000);
 
// Create the SOAP server
const xml = fs.readFileSync("productsService.wsdl", "utf8");
soap.listen(server, "/products", service, xml, function () {
  console.log("SOAP server running at http://localhost:8000/products?wsdl");
});

