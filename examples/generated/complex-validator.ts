// Auto-generated type definition
export type Complex = {
    id: number;
    name: string;
    price: number;
    discount?: number;
    tags?: string[];
    metadata?: {
        manufacturer?: string;
        warranty?: number;
    };
    status?: "available" | "out-of-stock" | "discontinued";
    variants?: {
        sku: string;
        attributes: Record<string, unknown>;
    }[];
};


export function validateComplex(value: unknown): value is Complex {
    if (typeof value !== "object" || value === null || Array.isArray(value))
        return false;
    if (!("id" in value && "name" in value && "price" in value))
        return false;
    if (typeof value.id !== "number")
        return false;
    if (!Number.isInteger(value.id))
        return false;
    if (value.id < 1)
        return false;
    if (typeof value.name !== "string")
        return false;
    if (value.name.length < 1)
        return false;
    if (value.name.length > 100)
        return false;
    if (typeof value.price !== "number")
        return false;
    if (value.price < 0)
        return false;
    if (value.price >= 1000000)
        return false;
    if ("discount" in value) {
        if (typeof value.discount !== "number")
            return false;
        if (value.discount < 0)
            return false;
        if (value.discount > 100)
            return false;
    }
    if ("tags" in value) {
        if (!Array.isArray(value.tags))
            return false;
        if (value.tags.length < 1)
            return false;
        if (value.tags.length > 10)
            return false;
        if (new Set(value.tags).size !== value.tags.length)
            return false;
        for (const item of value.tags) {
            if (typeof item !== "string")
                return false;
        }
    }
    if ("metadata" in value) {
        if (typeof value.metadata !== "object" || value.metadata === null || Array.isArray(value.metadata))
            return false;
        if (Object.keys(value.metadata).length < 1)
            return false;
        if (Object.keys(value.metadata).length > 5)
            return false;
        if ("manufacturer" in value.metadata) {
            if (typeof value.metadata.manufacturer !== "string")
                return false;
        }
        if ("warranty" in value.metadata) {
            if (typeof value.metadata.warranty !== "number")
                return false;
            if (!Number.isInteger(value.metadata.warranty))
                return false;
            if (value.metadata.warranty < 0)
                return false;
        }
    }
    if ("status" in value) {
        if (typeof value.status !== "string")
            return false;
        if (!["available", "out-of-stock", "discontinued"].includes(value.status))
            return false;
    }
    if ("variants" in value) {
        if (!Array.isArray(value.variants))
            return false;
        for (const item of value.variants) {
            if (typeof item !== "object" || item === null || Array.isArray(item))
                return false;
            if (!("sku" in item && "attributes" in item))
                return false;
            if (typeof item.sku !== "string")
                return false;
            if (!/^[A-Z0-9]{6,}$/.test(item.sku))
                return false;
            if (typeof item.attributes !== "object" || item.attributes === null || Array.isArray(item.attributes))
                return false;
        }
    }
    for (const key in value) {
        if (!["id", "name", "price", "discount", "tags", "metadata", "status", "variants"].includes(key))
            return false;
    }
    return true;
}
