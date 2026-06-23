import React from "react";

const AssetsTable = () => {
  return (
    <div className="overflow-x-auto">
      <table className="min-w-full divide-y divide-gray-200 dark:divide-gray-700">
        <thead className="bg-gray-50 dark:bg-gray-700">
          <tr>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
              ASX
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
              Price
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
              Qty
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
              Value
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
              Capital Gains
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
              Dividends
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
              Currency
            </th>
            <th className="px-6 py-3 text-left text-xs font-medium uppercase tracking-wider">
              Return
            </th>
          </tr>
        </thead>
        <tbody className="bg-white dark:bg-gray-800 divide-y divide-gray-200 dark:divide-gray-700">
          <tr>
            <td className="px-6 py-4 whitespace-nowrap text-blue-600">
              BHP.ASX Bhp Group Limited
            </td>
            <td className="px-6 py-4">46.495</td>
            <td className="px-6 py-4">348</td>
            <td className="px-6 py-4">16,180.26</td>
            <td className="px-6 py-4">4,473.54</td>
            <td className="px-6 py-4">7,919.23</td>
            <td className="px-6 py-4">0.00</td>
            <td className="px-6 py-4">12,392.77</td>
          </tr>
          <tr>
            <td className="px-6 py-4 whitespace-nowrap text-blue-600">
              VAS.ASX Vanguard Australian Shares Index Etf
            </td>
            <td className="px-6 py-4">92.35</td>
            <td className="px-6 py-4">450</td>
            <td className="px-6 py-4">41,557.50</td>
            <td className="px-6 py-4">5,845.50</td>
            <td className="px-6 py-4">11,086.31</td>
            <td className="px-6 py-4">0.00</td>
            <td className="px-6 py-4">16,931.81</td>
          </tr>
          <tr>
            <td className="px-6 py-4 whitespace-nowrap text-blue-600">
              VGS.ASX Vanguard Msci Index International Shares Etf
            </td>
            <td className="px-6 py-4">106.99</td>
            <td className="px-6 py-4">445</td>
            <td className="px-6 py-4">47,610.55</td>
            <td className="px-6 py-4">16,193.55</td>
            <td className="px-6 py-4">4,562.88</td>
            <td className="px-6 py-4">0.00</td>
            <td className="px-6 py-4">20,756.43</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

export default AssetsTable;
