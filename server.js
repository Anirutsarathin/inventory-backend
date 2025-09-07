const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

const loginRoutes = require("./login");
const employeeRoutes = require("./employee");
const chemicalRoutes = require("./chemical"); 
const roleRoutes = require("./role"); 


const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(bodyParser.json());

// รวม route จากไฟล์ต่างๆ
app.use(loginRoutes);
app.use(employeeRoutes);
app.use(chemicalRoutes);
app.use(roleRoutes);

app.listen(PORT, () => {
  console.log(`✅ Server running at http://localhost:${PORT}`);
});
