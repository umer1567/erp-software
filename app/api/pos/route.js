
import { NextResponse } from "next/server";

export const dynamic = "force-dynamic";

async function fetchFromInternalApi(path) {
  const { headers } = await import("next/headers");
  const requestHeaders = await headers();

  const host =
    requestHeaders.get("x-forwarded-host") ||
    requestHeaders.get("host");

  if (!host) {
    throw new Error("Unable to determine the application host.");
  }

  const protocol =
    requestHeaders.get("x-forwarded-proto") ||
    (process.env.NODE_ENV === "production" ? "https" : "http");

  return fetch(`${protocol}://${host}${path}`, {
    cache: "no-store",
    headers: {
      cookie: requestHeaders.get("cookie") || "",
    },
  });
}

export async function GET() {
  try {
    const [productsResponse, customersResponse, warehousesResponse] =
      await Promise.all([
        fetchFromInternalApi("/api/products"),
        fetchFromInternalApi("/api/customers"),
        fetchFromInternalApi("/api/warehouses"),
      ]);

    const [productsData, customersData, warehousesData] =
      await Promise.all([
        productsResponse.json(),
        customersResponse.json(),
        warehousesResponse.json(),
      ]);

    if (
      !productsResponse.ok ||
      !customersResponse.ok ||
      !warehousesResponse.ok
    ) {
      return NextResponse.json(
        { success: false, message: "Failed to load POS data." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      products: Array.isArray(productsData)
        ? productsData
        : productsData.products || [],
      customers: Array.isArray(customersData)
        ? customersData
        : customersData.customers || [],
      warehouses: Array.isArray(warehousesData)
        ? warehousesData
        : warehousesData.warehouses || [],
    });
  } catch (error) {
    console.error("POS GET ERROR:", error);

    return NextResponse.json(
      { success: false, message: "Unable to load POS data." },
      { status: 500 }
    );
  }
}

export async function POST(request) {
  try {
    const body = await request.json();

    const {
      customerId,
      warehouseId,
      invoiceDate,
      discount = 0,
      tax = 0,
      notes = "Created from POS",
      items,
      receivedAmount = 0,
      accountId = null,
      paymentMethod = "CASH",
      referenceNumber = null,
    } = body;

    const validCustomerId = Number(customerId);
    const validWarehouseId = Number(warehouseId);
    const parsedDiscount = Number(discount);
    const parsedTax = Number(tax);
    const parsedReceivedAmount = Number(receivedAmount);

    if (
      !Number.isInteger(validCustomerId) ||
      validCustomerId <= 0
    ) {
      return NextResponse.json(
        { success: false, message: "Please select a valid customer." },
        { status: 400 }
      );
    }

    if (
      !Number.isInteger(validWarehouseId) ||
      validWarehouseId <= 0
    ) {
      return NextResponse.json(
        { success: false, message: "Please select a valid warehouse." },
        { status: 400 }
      );
    }

    if (!Array.isArray(items) || items.length === 0) {
      return NextResponse.json(
        { success: false, message: "Add at least one product." },
        { status: 400 }
      );
    }

    if (items.length > 500) {
      return NextResponse.json(
        { success: false, message: "Too many items in one sale." },
        { status: 400 }
      );
    }

    if (
      !Number.isFinite(parsedDiscount) ||
      parsedDiscount < 0 ||
      !Number.isFinite(parsedTax) ||
      parsedTax < 0
    ) {
      return NextResponse.json(
        { success: false, message: "Invalid discount or tax amount." },
        { status: 400 }
      );
    }

    if (
      !Number.isFinite(parsedReceivedAmount) ||
      parsedReceivedAmount < 0
    ) {
      return NextResponse.json(
        { success: false, message: "Received amount must be zero or greater." },
        { status: 400 }
      );
    }

    let validPaymentAccountId = null;

    if (
      accountId !== null &&
      accountId !== undefined &&
      accountId !== ""
    ) {
      validPaymentAccountId = Number(accountId);

      if (
        !Number.isInteger(validPaymentAccountId) ||
        validPaymentAccountId <= 0
      ) {
        return NextResponse.json(
          { success: false, message: "Please select a valid cash/bank account." },
          { status: 400 }
        );
      }
    }

    if (parsedReceivedAmount > 0 && !validPaymentAccountId) {
      return NextResponse.json(
        {
          success: false,
          message: "Select a cash/bank account to record the received payment.",
        },
        { status: 400 }
      );
    }

    const cleanItems = items.map((item) => {
      const rawSubProductId = item.subProductId;

      return {
        productId: Number(item.productId),
        subProductId:
          rawSubProductId === null ||
          rawSubProductId === undefined ||
          rawSubProductId === ""
            ? null
            : Number(rawSubProductId),
        quantity: Number(item.quantity),
        unitPrice: Number(item.unitPrice),
        discount: Number(item.discount || 0),
        tax: Number(item.tax || 0),
      };
    });

    for (const item of cleanItems) {
      if (
        !Number.isInteger(item.productId) ||
        item.productId <= 0 ||
        (item.subProductId !== null &&
          (!Number.isInteger(item.subProductId) ||
            item.subProductId <= 0)) ||
        !Number.isFinite(item.quantity) ||
        item.quantity <= 0 ||
        !Number.isFinite(item.unitPrice) ||
        item.unitPrice < 0 ||
        !Number.isFinite(item.discount) ||
        item.discount < 0 ||
        !Number.isFinite(item.tax) ||
        item.tax < 0
      ) {
        return NextResponse.json(
          {
            success: false,
            message: "One or more sale items contain invalid values.",
          },
          { status: 400 }
        );
      }
    }

    const invoicePayload = {
      customerId: validCustomerId,
      warehouseId: validWarehouseId,
      invoiceDate: invoiceDate || new Date().toISOString().slice(0, 10),
      discount: parsedDiscount,
      tax: parsedTax,
      notes: String(notes ?? "Created from POS"),
      items: cleanItems,

      // These fields are handled inside the sales-invoice transaction.
      receivedAmount: parsedReceivedAmount,
      accountId: validPaymentAccountId,
      paymentMethod: String(paymentMethod || "CASH").trim().toUpperCase(),
      referenceNumber:
        referenceNumber === null ||
        referenceNumber === undefined ||
        String(referenceNumber).trim() === ""
          ? null
          : String(referenceNumber).trim(),
    };

    const { headers } = await import("next/headers");
    const requestHeaders = await headers();

    const host =
      requestHeaders.get("x-forwarded-host") ||
      requestHeaders.get("host");

    if (!host) {
      throw new Error("Unable to determine the application host.");
    }

    const protocol =
      requestHeaders.get("x-forwarded-proto") ||
      (process.env.NODE_ENV === "production" ? "https" : "http");

    const invoiceResponse = await fetch(
      `${protocol}://${host}/api/sales-invoices`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          cookie: requestHeaders.get("cookie") || "",
        },
        body: JSON.stringify(invoicePayload),
        cache: "no-store",
      }
    );

    const result = await invoiceResponse.json();

    return NextResponse.json(result, {
      status: invoiceResponse.status,
    });
  } catch (error) {
    console.error("POS POST ERROR:", error);

    return NextResponse.json(
      {
        success: false,
        message: error.message || "Failed to process the POS sale.",
      },
      { status: 500 }
    );
  }
}
