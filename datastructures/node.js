const node {
    id: number,
    inventoryNumber: string,
    name: string,
    category: categoryID,
    status: statusID,

    purchase: timestamp,
    price: number,
    supplier: string,
    depreciationPeriod: depreciationID,
    accountingType: "konsumtiv" | "investiv",

    createdBy: userID,
    createdAt: timestamp,
    lastEditBy: userID,
    lastEditAt: timestamp,
    assignedTo?: adGuid,

    location: locationID,
    networkEnvironment: networkEnvironmentID,

    manufacturer: string,
    model: string,
    serialnumber?: string,
    
    patchPanelLabel?: string,
    ipAddress?: ipAddressID,
    macAddress?: string[],

    leaseDurationMonths?: number,
    contractType?: "purchase" | "pay-per-page" | "lease",
    
    electronicTest?: electronicTestID,

    notes?: string,
}

const electronicTest {
    id: number,
    tester: string,
    lastTest: timestamp,
    lastTestResult: "fail" | "pass",
    nextTestPeriod: number,
    scale: "months" | "years"
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
    name: string,
    description: string
}

const location {
    id: number,
    city: string,
    address: string,
    houseNumber?: string,
    room?: string
}

const networkEnvironment {
    id: number,
    name: string
}

const systemuser {
    id: number,
    adGuid: string,
    username: string,
    role: "viewer" | "editor" | "admin",
    createdAt: timestamp,
    lastLogin: timestamp,
    isActivated: boolean
}