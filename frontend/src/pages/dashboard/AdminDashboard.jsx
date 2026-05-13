import { useState } from "react";
import AdminLayout from "../../components/AdminLayout";
import OverviewSection from "../../components/admin/OverviewSection";
import CoursesSection from "../../components/admin/CoursesSection";
import PaymentsSection from "../../components/admin/PaymentsSection";
import UsersSection from "../../components/admin/UsersSection";

const SECTIONS = {
  overview: OverviewSection,
  courses: CoursesSection,
  payments: PaymentsSection,
  users: UsersSection,
};

export default function AdminDashboard() {
  const [section, setSection] = useState("overview");
  const Section = SECTIONS[section] || OverviewSection;
  return (
    <AdminLayout section={section} setSection={setSection}>
      <Section />
    </AdminLayout>
  );
}
