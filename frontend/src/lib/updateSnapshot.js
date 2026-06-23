import { supabase } from "./supabase";

export const updatePortfolioSnapshot = async (userId) => {

  const { data: activities, error } = await supabase
    .from("activities")
    .select("quantity, price, type")
    .eq("user_id", userId);

  if (error) {
    console.error("❌ Error fetching activities:", error);
    return;
  }

  let totalValue = 0;
  for (const activity of activities) {
    const qty = parseFloat(activity.quantity);
    const price = parseFloat(activity.price);
    const type = activity.type?.toUpperCase();
    if (type === "BUY") totalValue += qty * price;
    if (type === "SELL") totalValue -= qty * price;
  }

  const today = new Date().toISOString().split("T")[0];

  const { error: insertError } = await supabase.from("portfolio_snapshots").insert({
    user_id: userId,
    date: today,
    total_value: totalValue,
  });

  if (insertError) {
    console.error("❌ Error inserting snapshot:", insertError);
  } else {
    console.log("Snapshot inserted failed");
  }
};
