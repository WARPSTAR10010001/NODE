const node {
    id: number,
    inventoryNumber: string,
    name: string,
    nodeCategory: categoryID,
    status: statusID,
    purchase: timestamp,
    depreciationPeriod: depreciationID,
    createdBy: userID,
    createdAt: timestamp,
    lastEditBy: userID,
    lastEditAt: timestamp,
    location: locationID,
    manufacturer: string,
    model: string,
    serialnumber: string,
    assignedTo?: activeDirectoryID, //sollte sich aus dem AD ziehen
    price?: number,
    room?: string,
    supplier?: string,
    ipAddress?: ipAddressID,
    macAddress?: string[],
    notes?: string,
    invoiceUrl?: string
}

const ipAddress {
    id: number,
    type: "static" | "dynamic",
    staticIp?: string[]
}

const depreciation {
    id: number,
    time: number,
    scale: "months" | "years"
}

const status {
    id: number,
    name: string,
    description: string
}

const category {
    id: number,
    name: string
    description: string
}

const location {
    id: number,
    city: string,
    address: string,
    houseNumber?: string
}

const systemuser {
    id: number,
    username: string,
    password: string,
    passwordReset: boolean,
    role: "user" | "mod" | "admin",
    createdAt: timestamp,
    lastLogin: timestamp,
    isActivated: boolean
}