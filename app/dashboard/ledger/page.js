// "use client";

// import { useEffect, useState } from "react";

// export default function LedgerPage() {
//   const [accounts, setAccounts] = useState([]);
//   const [accountId, setAccountId] = useState("");
//   const [ledger, setLedger] = useState([]);
//   const [selectedAccount, setSelectedAccount] =
//     useState(null);

//   const [loading, setLoading] = useState(true);
//   const [error, setError] = useState("");

//   useEffect(() => {
//     let cancelled = false;

//     async function loadAccounts() {
//       try {
//         const response =
//           await fetch("/api/accounts");

//         const data =
//           await response.json();

//         if (!cancelled) {
//           setAccounts(
//             data.accounts || []
//           );
//         }
//       } catch {
//         if (!cancelled) {
//           setError(
//             "Failed to load accounts."
//           );
//         }
//       } finally {
//         if (!cancelled) {
//           setLoading(false);
//         }
//       }
//     }

//     loadAccounts();

//     return () => {
//       cancelled = true;
//     };
//   }, []);

//   async function loadLedger(id) {
//     setAccountId(id);
//     setError("");

//     if (!id) {
//       setLedger([]);
//       setSelectedAccount(null);
//       return;
//     }

//     try {
//       const response = await fetch(
//         `/api/ledger?accountId=${id}`
//       );

//       const data =
//         await response.json();

//       if (!response.ok) {
//         throw new Error(
//           data.message ||
//             "Failed to load ledger."
//         );
//       }

//       setLedger(data.ledger || []);
//       setSelectedAccount(
//         data.account || null
//       );
//     } catch (error) {
//       setError(error.message);
//       setLedger([]);
//     }
//   }

//   if (loading) {
//     return (
//       <div className="p-6">
//         Loading ledger...
//       </div>
//     );
//   }

//   return (
//     <div>
//       <div className="mb-6">
//         <h1 className="text-3xl font-bold">
//           Ledger
//         </h1>

//         <p className="text-slate-500 mt-1">
//           View account-wise transaction history
//         </p>
//       </div>

//       {error && (
//         <div className="mb-5 bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
//           {error}
//         </div>
//       )}

//       <div className="bg-white border rounded-xl p-6 mb-6">
//         <label className="block font-medium mb-2">
//           Select Account
//         </label>

//         <select
//           value={accountId}
//           onChange={(e) =>
//             loadLedger(e.target.value)
//           }
//           className="w-full md:w-96 border rounded-lg px-4 py-3"
//         >
//           <option value="">
//             Select Account
//           </option>

//           {accounts.map((account) => (
//             <option
//               key={account.account_id}
//               value={account.account_id}
//             >
//               {account.account_code} -{" "}
//               {account.account_name}
//             </option>
//           ))}
//         </select>
//       </div>

//       {selectedAccount && (
//         <div className="bg-white border rounded-xl overflow-hidden">
//           <div className="p-5 border-b">
//             <h2 className="text-xl font-semibold">
//               {selectedAccount.account_code} -{" "}
//               {selectedAccount.account_name}
//             </h2>

//             <p className="text-slate-500">
//               {selectedAccount.account_type}
//             </p>
//           </div>

//           <div className="overflow-x-auto">
//             <table className="w-full">
//               <thead className="bg-slate-50">
//                 <tr>
//                   <th className="p-4 text-left">
//                     Date
//                   </th>

//                   <th className="p-4 text-left">
//                     Journal
//                   </th>

//                   <th className="p-4 text-left">
//                     Description
//                   </th>

//                   <th className="p-4 text-right">
//                     Debit
//                   </th>

//                   <th className="p-4 text-right">
//                     Credit
//                   </th>

//                   <th className="p-4 text-right">
//                     Balance
//                   </th>
//                 </tr>
//               </thead>

//               <tbody>
//                 {ledger.map((row) => (
//                   <tr
//                     key={
//                       row.journal_item_id
//                     }
//                     className="border-t"
//                   >
//                     <td className="p-4">
//                       {row.journal_date}
//                     </td>

//                     <td className="p-4">
//                       {row.journal_number}
//                     </td>

//                     <td className="p-4">
//                       {row.description ||
//                         row.journal_description ||
//                         "-"}
//                     </td>

//                     <td className="p-4 text-right">
//                       {Number(
//                         row.debit
//                       ).toFixed(2)}
//                     </td>

//                     <td className="p-4 text-right">
//                       {Number(
//                         row.credit
//                       ).toFixed(2)}
//                     </td>

//                     <td className="p-4 text-right font-medium">
//                       {Number(
//                         row.running_balance
//                       ).toFixed(2)}
//                     </td>
//                   </tr>
//                 ))}

//                 {ledger.length === 0 && (
//                   <tr>
//                     <td
//                       colSpan="6"
//                       className="p-8 text-center text-slate-500"
//                     >
//                       No transactions found.
//                     </td>
//                   </tr>
//                 )}
//               </tbody>
//             </table>
//           </div>
//         </div>
//       )}
//     </div>
//   );
// }
"use client";

import { useEffect, useState } from "react";

export default function ItemsLedgerPage() {
  const [products, setProducts] = useState([]);
  const [ledger, setLedger] = useState([]);

  const [productId, setProductId] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [location, setLocation] = useState("");

  const [loading, setLoading] = useState(false);
  const [productsLoading, setProductsLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadProducts() {
      try {
        const response = await fetch("/api/products");
        const data = await response.json();

        if (!response.ok) {
          throw new Error(
            data.message || "Failed to load products."
          );
        }

        setProducts(data.products || []);
      } catch (error) {
        setError(error.message);
      } finally {
        setProductsLoading(false);
      }
    }

    loadProducts();
  }, []);

  async function loadLedger() {
    if (!productId) {
      setLedger([]);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const params = new URLSearchParams();

      params.set("productId", productId);

      if (fromDate) {
        params.set("fromDate", fromDate);
      }

      if (toDate) {
        params.set("toDate", toDate);
      }

      if (location) {
        params.set("location", location);
      }

      const response = await fetch(
        `/api/items-ledger?${params.toString()}`
      );

      const data = await response.json();

      if (!response.ok) {
        throw new Error(
          data.message || "Failed to load item ledger."
        );
      }

      setLedger(data.ledger || []);
    } catch (error) {
      setError(error.message);
      setLedger([]);
    } finally {
      setLoading(false);
    }
  }

  function formatNumber(value) {
    return Number(value || 0).toFixed(2);
  }

  const selectedProduct = products.find(
    (product) =>
      String(product.product_id) === String(productId)
  );

  return (
    <div className="space-y-6">

      {/* HEADER */}
      <div>
        <h1 className="text-3xl font-bold text-slate-900">
          Items Ledger
        </h1>

        <p className="text-slate-500 mt-1">
          View item-wise stock transactions, rates and running quantity.
        </p>
      </div>

      {/* ERROR */}
      {error && (
        <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg">
          {error}
        </div>
      )}

      {/* FILTERS */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm p-6">

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-5">

          {/* FROM DATE */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              From Date
            </label>

            <input
              type="date"
              value={fromDate}
              onChange={(e) =>
                setFromDate(e.target.value)
              }
              className="w-full border border-slate-300 rounded-md px-3 py-2.5 text-sm"
            />
          </div>

          {/* TO DATE */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              To Date
            </label>

            <input
              type="date"
              value={toDate}
              onChange={(e) =>
                setToDate(e.target.value)
              }
              className="w-full border border-slate-300 rounded-md px-3 py-2.5 text-sm"
            />
          </div>

          {/* LOCATION */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Location
            </label>

            <select
              value={location}
              onChange={(e) =>
                setLocation(e.target.value)
              }
              className="w-full border border-slate-300 rounded-md px-3 py-2.5 text-sm bg-white"
            >
              <option value="">
                All Locations
              </option>

              <option value="Main Warehouse">
                Main Warehouse
              </option>

              <option value="Store">
                Store
              </option>

              <option value="Godown">
                Godown
              </option>
            </select>
          </div>

          {/* ITEMS */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">
              Items
            </label>

            <select
              value={productId}
              onChange={(e) =>
                setProductId(e.target.value)
              }
              disabled={productsLoading}
              className="w-full border border-slate-300 rounded-md px-3 py-2.5 text-sm bg-white"
            >
              <option value="">
                {productsLoading
                  ? "Loading Items..."
                  : "Select Item"}
              </option>

              {products.map((product) => (
                <option
                  key={product.product_id}
                  value={product.product_id}
                >
                  {product.sku} - {product.product_name}
                </option>
              ))}
            </select>
          </div>

        </div>

        {/* BUTTON */}
        <div className="mt-5 flex justify-end">

          <button
            type="button"
            onClick={loadLedger}
            disabled={!productId || loading}
            className="bg-slate-900 text-white px-6 py-2.5 rounded-lg hover:bg-slate-800 disabled:opacity-50"
          >
            {loading
              ? "Loading..."
              : "View Ledger"}
          </button>

        </div>
      </div>

      {/* SELECTED ITEM */}
      {selectedProduct && (
        <div className="bg-white border border-slate-200 rounded-xl p-5">

          <div className="flex flex-col md:flex-row md:justify-between gap-4">

            <div>
              <p className="text-sm text-slate-500">
                Item
              </p>

              <h2 className="text-xl font-semibold text-slate-900">
                {selectedProduct.product_name}
              </h2>

              <p className="text-sm text-slate-500 mt-1">
                {selectedProduct.sku}
              </p>
            </div>

            <div className="text-left md:text-right">
              <p className="text-sm text-slate-500">
                Unit
              </p>

              <p className="font-semibold">
                {selectedProduct.unit || "PCS"}
              </p>
            </div>

          </div>
        </div>
      )}

      {/* LEDGER TABLE */}
      <div className="bg-white border border-slate-200 rounded-xl shadow-sm overflow-hidden">

        <div className="px-6 py-5 border-b bg-slate-50">

          <h2 className="text-xl font-semibold text-slate-900">
            Items Ledger
          </h2>

          <p className="text-sm text-slate-500 mt-1">
            Stock movement and item rate history.
          </p>

        </div>

        <div className="overflow-x-auto">

          <table className="min-w-[1800px] w-full text-sm">

            <thead className="bg-slate-100">

              <tr>

                <th className="px-4 py-3 text-left whitespace-nowrap">
                  Trandate
                </th>

                <th className="px-4 py-3 text-left whitespace-nowrap">
                  Transaction Type
                </th>

                <th className="px-4 py-3 text-left whitespace-nowrap">
                  Transaction Number
                </th>

                <th className="px-4 py-3 text-left">
                  UOM
                </th>

                <th className="px-4 py-3 text-left">
                  Memo
                </th>

                <th className="px-4 py-3 text-right whitespace-nowrap">
                  Transaction Rate
                </th>

                <th className="px-4 py-3 text-right whitespace-nowrap">
                  Old Rate
                </th>

                <th className="px-4 py-3 text-right whitespace-nowrap">
                  Actual Rate
                </th>

                <th className="px-4 py-3 text-right whitespace-nowrap">
                  New Rate
                </th>

                <th className="px-4 py-3 text-right whitespace-nowrap">
                  Receive Quantity
                </th>

                <th className="px-4 py-3 text-right whitespace-nowrap">
                  Receive Rate
                </th>

                <th className="px-4 py-3 text-right whitespace-nowrap">
                  Receive Amount
                </th>

                <th className="px-4 py-3 text-right whitespace-nowrap">
                  Issue Quantity
                </th>

                <th className="px-4 py-3 text-right whitespace-nowrap">
                  Issue Rate
                </th>

                <th className="px-4 py-3 text-right whitespace-nowrap">
                  Issue Amount
                </th>

                <th className="px-4 py-3 text-right whitespace-nowrap">
                  Running Total
                </th>

              </tr>

            </thead>

            <tbody>

              {ledger.map((row, index) => (

                <tr
                  key={
                    row.item_ledger_id ||
                    row.transaction_id ||
                    index
                  }
                  className="border-t hover:bg-slate-50"
                >

                  <td className="px-4 py-3 whitespace-nowrap">
                    {row.trandate || "-"}
                  </td>

                  <td className="px-4 py-3 whitespace-nowrap font-medium">
                    {row.transaction_type || "-"}
                  </td>

                  <td className="px-4 py-3 whitespace-nowrap">
                    {row.transaction_number || "-"}
                  </td>

                  <td className="px-4 py-3">
                    {row.uom || selectedProduct?.unit || "-"}
                  </td>

                  <td className="px-4 py-3">
                    {row.memo || "-"}
                  </td>

                  <td className="px-4 py-3 text-right">
                    {formatNumber(row.transaction_rate)}
                  </td>

                  <td className="px-4 py-3 text-right">
                    {formatNumber(row.old_rate)}
                  </td>

                  <td className="px-4 py-3 text-right">
                    {formatNumber(row.actual_rate)}
                  </td>

                  <td className="px-4 py-3 text-right">
                    {formatNumber(row.new_rate)}
                  </td>

                  <td className="px-4 py-3 text-right">
                    {formatNumber(row.receive_quantity)}
                  </td>

                  <td className="px-4 py-3 text-right">
                    {formatNumber(row.receive_rate)}
                  </td>

                  <td className="px-4 py-3 text-right">
                    {formatNumber(row.receive_amount)}
                  </td>

                  <td className="px-4 py-3 text-right">
                    {formatNumber(row.issue_quantity)}
                  </td>

                  <td className="px-4 py-3 text-right">
                    {formatNumber(row.issue_rate)}
                  </td>

                  <td className="px-4 py-3 text-right">
                    {formatNumber(row.issue_amount)}
                  </td>

                  <td className="px-4 py-3 text-right font-semibold">
                    {formatNumber(row.running_total)}
                  </td>

                </tr>

              ))}

              {ledger.length === 0 && !loading && (

                <tr>
                  <td
                    colSpan="16"
                    className="px-6 py-12 text-center text-slate-500"
                  >
                    {productId
                      ? "No item transactions found."
                      : "Select an item and click View Ledger."}
                  </td>
                </tr>

              )}

            </tbody>

          </table>

        </div>

        {/* TOTALS */}
        {ledger.length > 0 && (

          <div className="border-t bg-slate-50 px-6 py-4">

            <div className="grid grid-cols-1 md:grid-cols-4 gap-5">

              <div>
                <p className="text-xs text-slate-500">
                  Total Received
                </p>

                <p className="font-semibold">
                  {formatNumber(
                    ledger.reduce(
                      (total, row) =>
                        total +
                        Number(
                          row.receive_quantity || 0
                        ),
                      0
                    )
                  )}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500">
                  Total Issued
                </p>

                <p className="font-semibold">
                  {formatNumber(
                    ledger.reduce(
                      (total, row) =>
                        total +
                        Number(
                          row.issue_quantity || 0
                        ),
                      0
                    )
                  )}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500">
                  Transactions
                </p>

                <p className="font-semibold">
                  {ledger.length}
                </p>
              </div>

              <div>
                <p className="text-xs text-slate-500">
                  Current Stock
                </p>

                <p className="font-semibold">
                  {formatNumber(
                    ledger[ledger.length - 1]
                      ?.running_total
                  )}
                </p>
              </div>

            </div>

          </div>

        )}

      </div>

    </div>
  );
}