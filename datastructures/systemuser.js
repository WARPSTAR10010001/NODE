const systemuser {
    id: number,
    username: string, //...@rheinberg.de
    password: string,
    passwordReset: boolean,
    role: "user" | "mod" | "admin",
    createdAt: timestamp,
    lastLogin: timestamp,
    isActivated: boolean
}