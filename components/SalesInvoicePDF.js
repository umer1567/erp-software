import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
} from "@react-pdf/renderer";

const styles = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
  },

  title: {
    fontSize: 20,
    marginBottom: 20,
    fontWeight: "bold",
  },

  header: {
    marginBottom: 20,
  },

  table: {
    marginTop: 20,
  },

  row: {
    flexDirection: "row",
    borderBottomWidth: 1,
    paddingVertical: 6,
  },

  product: {
    width: "40%",
  },

  quantity: {
    width: "15%",
  },

  price: {
    width: "20%",
    textAlign: "right",
  },

  total: {
    width: "25%",
    textAlign: "right",
  },

  summary: {
    marginTop: 20,
    marginLeft: "60%",
  },

  summaryRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 5,
  },
});

export default function SalesInvoicePDF({
  invoice,
}) {
  return (
    <Document>
      <Page size="A4" style={styles.page}>
        <Text style={styles.title}>
          SALES INVOICE
        </Text>

        <View style={styles.header}>
          <Text>
            Invoice: {invoice.invoice_number}
          </Text>

          <Text>
            Date: {invoice.invoice_date}
          </Text>

          <Text>
            Customer: {invoice.customer_name}
          </Text>
        </View>

        <View style={styles.table}>
          <View style={styles.row}>
            <Text style={styles.product}>
              Product
            </Text>

            <Text style={styles.quantity}>
              Qty
            </Text>

            <Text style={styles.price}>
              Price
            </Text>

            <Text style={styles.total}>
              Total
            </Text>
          </View>

          {invoice.items?.map((item) => (
            <View
              style={styles.row}
              key={item.invoice_item_id}
            >
              <Text style={styles.product}>
                {item.product_name}
              </Text>

              <Text style={styles.quantity}>
                {item.quantity}
              </Text>

              <Text style={styles.price}>
                {Number(
                  item.unit_price
                ).toLocaleString()}
              </Text>

              <Text style={styles.total}>
                {Number(
                  item.line_total
                ).toLocaleString()}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.summary}>
          <View style={styles.summaryRow}>
            <Text>Subtotal</Text>
            <Text>
              PKR {Number(invoice.subtotal).toLocaleString()}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text>Discount</Text>
            <Text>
              PKR {Number(invoice.discount).toLocaleString()}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text>Tax</Text>
            <Text>
              PKR {Number(invoice.tax).toLocaleString()}
            </Text>
          </View>

          <View style={styles.summaryRow}>
            <Text>Total</Text>
            <Text>
              PKR {Number(invoice.total_amount).toLocaleString()}
            </Text>
          </View>
        </View>
      </Page>
    </Document>
  );
}