import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Activity, IndianRupee, ListOrdered, Sparkles } from "lucide-react";
import { Card, CardContent } from "@/components/ui/card";
import { PageHeader } from "@/components/layout/PageHeader";
import { StatCard } from "@/components/layout/StatCard";
import { orderService } from "@/services/orderService";
import { formatINR } from "@/lib/format";

export const Route = createFileRoute("/admin/analytics")({
  head: () => ({ meta: [{ title: "Analytics — Admin · Sora Print Hub" }] }),
  component: AnalyticsPage,
});

const ORDERS_BY_DAY = [
  { day: "Mon", orders: 12 },
  { day: "Tue", orders: 17 },
  { day: "Wed", orders: 9 },
  { day: "Thu", orders: 22 },
  { day: "Fri", orders: 28 },
  { day: "Sat", orders: 31 },
  { day: "Sun", orders: 19 },
];

const REVENUE_MONTH = Array.from({ length: 12 }).map((_, i) => ({
  day: `D${i + 1}`,
  revenue: 1200 + Math.round(Math.sin(i / 2) * 600 + i * 90),
}));

const SERVICES = [
  { name: "Printing", value: 58 },
  { name: "Passport photos", value: 18 },
  { name: "Lamination", value: 14 },
  { name: "Binding", value: 10 },
];

const CHART_COLORS = ["var(--chart-1)", "var(--chart-2)", "var(--chart-3)", "var(--chart-4)"];

function AnalyticsPage() {
  const { data } = useQuery({ queryKey: ["orders"], queryFn: () => orderService.list() });
  const all = data ?? [];
  const today = new Date().toDateString();
  const ordersToday = all.filter((o) => new Date(o.createdAt).toDateString() === today).length;
  const ordersWeek = all.filter((o) => Date.now() - new Date(o.createdAt).getTime() < 7 * 86400000).length;
  const ordersMonth = all.filter((o) => Date.now() - new Date(o.createdAt).getTime() < 30 * 86400000).length;
  const revenueToday = all
    .filter((o) => new Date(o.createdAt).toDateString() === today)
    .reduce((s, o) => s + o.total, 0);
  const revenueMonth = all
    .filter((o) => Date.now() - new Date(o.createdAt).getTime() < 30 * 86400000)
    .reduce((s, o) => s + o.total, 0);

  return (
    <>
      <PageHeader title="Analytics" description="Shop performance over time. Sample data." />

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        <StatCard label="Orders today" value={ordersToday} icon={<ListOrdered className="h-5 w-5" />} accent="primary" />
        <StatCard label="Orders this week" value={ordersWeek} icon={<Activity className="h-5 w-5" />} accent="info" />
        <StatCard label="Orders this month" value={ordersMonth} icon={<ListOrdered className="h-5 w-5" />} accent="warning" />
        <StatCard label="Revenue today" value={formatINR(revenueToday)} icon={<IndianRupee className="h-5 w-5" />} accent="success" />
        <StatCard label="Revenue this month" value={formatINR(revenueMonth)} icon={<IndianRupee className="h-5 w-5" />} accent="primary" />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Card>
          <CardContent className="p-5">
            <h3 className="font-semibold">Orders this week</h3>
            <div className="mt-4 h-64">
              <ResponsiveContainer>
                <BarChart data={ORDERS_BY_DAY}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                  <Tooltip
                    contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }}
                  />
                  <Bar dataKey="orders" radius={[6, 6, 0, 0]} fill="var(--chart-1)" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardContent className="p-5">
            <h3 className="font-semibold">Revenue this month</h3>
            <div className="mt-4 h-64">
              <ResponsiveContainer>
                <LineChart data={REVENUE_MONTH}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="day" stroke="var(--muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                  <Tooltip
                    contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }}
                    formatter={(v: number) => formatINR(v)}
                  />
                  <Line type="monotone" dataKey="revenue" stroke="var(--chart-1)" strokeWidth={2.5} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>

        <Card className="lg:col-span-2">
          <CardContent className="grid gap-6 p-5 lg:grid-cols-[1fr_280px]">
            <div>
              <h3 className="font-semibold">Service mix</h3>
              <p className="mt-1 text-sm text-muted-foreground">What customers order most.</p>
              <div className="mt-4 h-64">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie data={SERVICES} dataKey="value" nameKey="name" innerRadius={50} outerRadius={90} paddingAngle={2}>
                      {SERVICES.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} />)}
                    </Pie>
                    <Tooltip
                      contentStyle={{ background: "var(--popover)", border: "1px solid var(--border)", borderRadius: 8 }}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
            <div className="space-y-3">
              <div className="flex items-center gap-2 text-sm font-semibold">
                <Sparkles className="h-4 w-4 text-primary" /> Most popular
              </div>
              <p className="text-2xl font-bold">Printing</p>
              <p className="text-sm text-muted-foreground">
                58% of orders include document printing. Lamination is growing fastest week over week.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </>
  );
}
