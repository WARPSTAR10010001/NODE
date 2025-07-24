const express = require("express");
const session = require("express-session")
const app = express();
const { requireLogin, requireModerator, errorLogger, requestLogger } = require("./actionHandler");
const PORT = 1000;

app.use(express.json());
app.use(session({
    secret: "ein langfristig geheimer string", //muss ersetzt werden durch env datei
    resave: false,
    saveUninitialized: false,
    cookie: {
        secure: false,
        httpOnly: true,
        maxAge: 1000 * 60 * 60,
    }
}));
app.use(requestLogger);

const userRoutes = require("./routes/user.routes");
const adminRoutes = require("./routes/admin.router");
const deviceRoutes = require("./routes/device.routes");
const lendingRoutes = require("./routes/lending.routes");
const reservationRoutes = require("./routes/reservation.routes");

app.use("/users", userRoutes);
app.use("/admin", adminRoutes);
app.use("/devices", deviceRoutes);
app.use("/lendings", lendingRoutes);
app.use("/reservations", reservationRoutes);

app.get("/", (req, res) => {
    res.status(200).send("NODEBACK läuft!");
});

app.use(errorLogger);

app.listen(PORT, () => console.log(`[START] NODEBACK läuft!`));