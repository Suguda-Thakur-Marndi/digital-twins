import { redirect } from "next/navigation";

export default async function PatientDynamicPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  redirect(`/twin?patient=${encodeURIComponent(id)}`);
}
