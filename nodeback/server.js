const express = require('express');
const app = express();
const fs = require('fs');
const path = require('path');

app.use(express.json());

const userRoutes = require(".routes/user.routes");
const deviceRoutes = require(".routes/device.routes");
const lendingRoutes = require(".routes/lending.routes");
const reservationRoutes = require(".routes/reservation.routes");

app.use("/users", userRoutes);
app.use("/devices", deviceRoutes);
app.use("/lendings", lendingRoutes);
app.use("/reservations", reservationRoutes);

const PORT = 1000;
app.listen(PORT, () => console.log(`NODEBACK läuft auf Port ${PORT}`));