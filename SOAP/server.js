const soap = require("soap");
const fs = require("node:fs");
const http = require("http");

// Define the service implementation
const service = {
  ProductsService: {
    ProductsPort: {
      CreateProduct: function (args, callback) {
        // Log args received
        console.log("ARGS : ", args);

		// Send response with args and fake id.
        callback({ ...args, id: "myid" });
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