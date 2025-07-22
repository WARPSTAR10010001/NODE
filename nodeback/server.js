const express = require('express');
const app = express();
const errorHandler = require("./errorHandler");
const logHandler = require("./logHandler");
const PORT = 1000;

app.use(express.json());
app.use(logHandler);

const userRoutes = require("./routes/user.routes");
const deviceRoutes = require("./routes/device.routes");
const lendingRoutes = require("./routes/lending.routes");
const reservationRoutes = require("./routes/reservation.routes");

app.use("/users", userRoutes);
app.use("/devices", deviceRoutes);
app.use("/lendings", lendingRoutes);
app.use("/reservations", reservationRoutes);

app.get("/", (req, res) => {
    console.log("Request: Root")
    res.status(200).send("NODEBACK läuft!");
});

app.use(errorHandler);

app.listen(PORT, () => console.log(`NODEBACK läuft auf Port ${PORT}`));