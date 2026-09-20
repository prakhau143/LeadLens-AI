import { Navbar } from "@/components/layout/navbar";
import { Hero } from "@/components/dashboard/hero";
import { DashboardStats } from "@/components/dashboard/dashboard-stats";
import { TechnicalDetails } from "@/components/dashboard/technical-details";

export default function DashboardPage() {
  return (
    <>
      <Navbar />
      <main className="flex w-full flex-1 flex-col gap-8 px-4 py-10 sm:px-6 lg:px-8 xl:px-12">
        <Hero />
        <DashboardStats />
        <TechnicalDetails />
      </main>
    </>
  );
}
