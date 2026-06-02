"use client";

import { BookOpen, Building2, GraduationCap, Handshake, Landmark, Stethoscope } from "lucide-react";

const ORG_ICONS: Record<string, React.ReactNode> = {
  government: <Landmark className="h-5 w-5" />,
  university: <GraduationCap className="h-5 w-5" />,
  hospital: <Stethoscope className="h-5 w-5" />,
  school: <BookOpen className="h-5 w-5" />,
  ngo: <Handshake className="h-5 w-5" />,
  company: <Building2 className="h-5 w-5" />,
};

export default function OrgTypeIcon({ slug, className }: { slug: string; className?: string }) {
  return (
    <div className={`flex h-10 w-10 items-center justify-center rounded-xl ${className || "bg-blue-50 text-blue-600"}`}>
      {ORG_ICONS[slug] || <Building2 className="h-5 w-5" />}
    </div>
  );
}
