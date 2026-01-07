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
    networkEnvironment: networkEnvironmentID,
    manufacturer: string,
    model: string,
    serialnumber: string,
    accountingType: "konsumtiv" | "investiv",
    price?: number,
    assignedTo?: adGuid,
    patchPanelLabel?: string,
    supplier?: string,
    ipAddress?: ipAddressID,
    macAddress?: string[],
    
    leaseDurationMonths?: number,
    contractType?: "purchase" | "pay-per-page" | "lease",
    
    electronicTest?: electronicTestID,

    notes?: string,
    invoiceUrl?: string[]
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