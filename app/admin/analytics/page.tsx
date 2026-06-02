"use client";

import { supabase } from "@/lib/supabase";
import AdminNav from "@/components/AdminNav";
import { Download, Filter, X } from "lucide-react";
import { useCallback, useEffect, useMemo, useState } from "react";
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
  Legend,
} from "recharts";
import * as XLSX from "xlsx";

const COLORS = [
  "#2563EB", "#10B981", "#F59E0B", "#EF4444", "#8B5CF6",
  "#EC4899", "#06B6D4", "#84CC16", "#F97316", "#6366F1",
  "#14B8A6", "#A855F7", "#F43F5E", "#0EA5E9", "#65A30D",
];

const CHART_COLORS = {
  primary: "#2563EB",
  success: "#10B981",
  warning: "#F59E0B",
  danger: "#EF4444",
  purple: "#8B5CF6",
  pink: "#EC4899",
  cyan: "#06B6D4",
  lime: "#84CC16",
  orange: "#F97316",
  indigo: "#6366F1",
};

interface Filters {
  dateFrom: string;
  dateTo: string;
  location: string;
  campaignStatus: string;
  donationStatus: string;
  userRole: string;
}

interface RegionData {
  region: string;
  donorCount: number;
  recipientCount: number;
  campaignCount: number;
  donationCount: number;
  totalGoal: number;
  totalCollected: number;
  avgRating: number;
}

interface AnalyticsData {
  totalUsers: number;
  totalDonors: number;
  totalRecipients: number;
  totalAdmins: number;
  totalCampaigns: number;
  totalDonations: number;
  totalRequests: number;
  totalRatings: number;
  totalReports: number;
  totalSubmissions: number;
  totalMessages: number;

  usersByRole: { name: string; value: number }[];
  campaignsByStatus: { name: string; value: number }[];
  campaignsByCategory: { name: string; value: number }[];
  campaignsByOrgType: { name: string; value: number }[];
  donationsByStatus: { name: string; value: number }[];
  donationsByCategory: { name: string; value: number }[];
  requestsByStatus: { name: string; value: number }[];
  ratingsDistribution: { name: string; value: number }[];
  reportsByStatus: { name: string; value: number }[];
  reportsByType: { name: string; value: number }[];
  submissionsByStatus: { name: string; value: number }[];
  submissionsByOrgType: { name: string; value: number }[];
  priorityDistribution: { name: string; value: number }[];

  campaignsOverTime: { date: string; created: number }[];
  donationsOverTime: { date: string; created: number }[];
  usersOverTime: { date: string; donors: number; recipients: number }[];

  regionData: RegionData[];

  totalGoalAmount: number;
  totalCollectedAmount: number;
  campaignSuccessRate: number;
  requestApprovalRate: number;
  averageRating: number;
  requestApproved: number;
  requestPending: number;
  requestRejected: number;
  campaignActive: number;
  campaignCompleted: number;
  campaignPaused: number;
  campaignPending: number;
  campaignRejected: number;
  donationAvailable: number;
  donationClaimed: number;
  donationCompleted: number;
  donationPending: number;
  donationRejected: number;
}

const defaultFilters: Filters = {
  dateFrom: "",
  dateTo: "",
  location: "",
  campaignStatus: "",
  donationStatus: "",
  userRole: "",
};

export default function AnalyticsPage() {
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [filters, setFilters] = useState<Filters>(defaultFilters);
  const [showFilters, setShowFilters] = useState(false);
  const [allLocations, setAllLocations] = useState<string[]>([]);

  const buildFilterQuery = useCallback((table: string, dateField = "created_at") => {
    let query = supabase.from(table).select("*", { count: "exact", head: true });
    if (filters.dateFrom) query = query.gte(dateField, filters.dateFrom);
    if (filters.dateTo) query = query.lte(dateField, filters.dateTo + "T23:59:59");
    if (filters.location && table === "profiles") query = query.eq("location", filters.location);
    if (filters.location && table === "campaigns") query = query.eq("location", filters.location);
    if (filters.location && table === "donations") query = query.eq("location", filters.location);
    if (filters.campaignStatus && table === "campaigns") query = query.eq("status", filters.campaignStatus);
    if (filters.donationStatus && table === "donations") query = query.eq("status", filters.donationStatus);
    if (filters.userRole && table === "profiles") query = query.eq("role", filters.userRole);
    return query;
  }, [filters]);

  const buildSelectQuery = useCallback((table: string, columns: string, dateField = "created_at") => {
    let query = supabase.from(table).select(columns);
    if (filters.dateFrom) query = query.gte(dateField, filters.dateFrom);
    if (filters.dateTo) query = query.lte(dateField, filters.dateTo + "T23:59:59");
    if (filters.location && (table === "profiles" || table === "campaigns" || table === "donations")) {
      query = query.eq("location", filters.location);
    }
    if (filters.campaignStatus && table === "campaigns") query = query.eq("status", filters.campaignStatus);
    if (filters.donationStatus && table === "donations") query = query.eq("status", filters.donationStatus);
    if (filters.userRole && table === "profiles") query = query.eq("role", filters.userRole);
    return query;
  }, [filters]);

  const fetchData = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true);
    else setRefreshing(true);
    try {
      const [
        { count: totalUsers },
        { count: totalDonors },
        { count: totalRecipients },
        { count: totalAdmins },
        { count: totalCampaigns },
        { count: totalDonations },
        { count: totalRequests },
        { count: totalRatings },
        { count: totalReports },
        { count: totalSubmissions },
        { count: totalMessages },
        usersRes,
        campaignsRes,
        donationsRes,
        requestsRes,
        ratingsRes,
        reportsRes,
        submissionsRes,
      ] = await Promise.all([
        buildFilterQuery("profiles"),
        buildFilterQuery("profiles").eq("role", "donor"),
        buildFilterQuery("profiles").eq("role", "recipient"),
        buildFilterQuery("profiles").eq("role", "admin"),
        buildFilterQuery("campaigns"),
        buildFilterQuery("donations"),
        buildFilterQuery("requests"),
        buildFilterQuery("ratings"),
        buildFilterQuery("reports"),
        buildFilterQuery("verification_submissions"),
        buildFilterQuery("messages"),
        buildSelectQuery("profiles", "role, location, created_at"),
        buildSelectQuery("campaigns", "status, category, org_type, priority_level, location, created_at, goal_amount, collected_amount"),
        buildSelectQuery("donations", "status, category, location, created_at"),
        buildSelectQuery("requests", "status"),
        buildSelectQuery("ratings", "rating, recipient_id"),
        buildSelectQuery("reports", "status, type"),
        buildSelectQuery("verification_submissions", "status, org_type_slug, priority_level"),
      ]);

      const campaigns = campaignsRes.data || [];
      const donations = donationsRes.data || [];
      const requests = requestsRes.data || [];
      const ratings = ratingsRes.data || [];
      const reports = reportsRes.data || [];
      const submissions = submissionsRes.data || [];
      const profiles = usersRes.data || [];

      const campaignsOverTime = campaigns;
      const donationsOverTime = donations;
      const usersOverTimeData = profiles;

      // ── Unique locations ──
      const uniqueLocations = [...new Set(
        profiles.map((p: any) => p.location).filter(Boolean)
      )].sort() as string[];
      setAllLocations(uniqueLocations);

      // ── Users by role ──
      const donorCount = profiles.filter((p: any) => p.role === "donor").length;
      const recipientCount = profiles.filter((p: any) => p.role === "recipient").length;
      const adminCount = profiles.filter((p: any) => p.role === "admin").length;

      const usersByRole = [
        { name: "Donors", value: donorCount },
        { name: "Recipients", value: recipientCount },
        { name: "Admins", value: adminCount },
      ].filter((d) => d.value > 0);

      // ── Campaigns ──
      const campaignStatusCount: Record<string, number> = {};
      const campaignCategoryCount: Record<string, number> = {};
      const campaignOrgTypeCount: Record<string, number> = {};
      const priorityCount: Record<string, number> = {};
      campaigns.forEach((c: any) => {
        const s = c.status || "unknown";
        campaignStatusCount[s] = (campaignStatusCount[s] || 0) + 1;
        campaignCategoryCount[c.category] = (campaignCategoryCount[c.category] || 0) + 1;
        if (c.org_type) campaignOrgTypeCount[c.org_type] = (campaignOrgTypeCount[c.org_type] || 0) + 1;
        if (c.priority_level) priorityCount[c.priority_level] = (priorityCount[c.priority_level] || 0) + 1;
      });

      const campaignsByStatus = Object.entries(campaignStatusCount).map(([name, value]) => ({ name, value }));
      const campaignsByCategory = Object.entries(campaignCategoryCount).map(([name, value]) => ({ name, value }));
      const campaignsByOrgType = Object.entries(campaignOrgTypeCount).map(([name, value]) => ({ name, value }));
      const priorityDistribution = Object.entries(priorityCount).map(([name, value]) => ({ name, value }));

      // ── Donations ──
      const donationStatusCount: Record<string, number> = {};
      const donationCategoryCount: Record<string, number> = {};
      donations.forEach((d: any) => {
        const s = d.status || "unknown";
        donationStatusCount[s] = (donationStatusCount[s] || 0) + 1;
        donationCategoryCount[d.category] = (donationCategoryCount[d.category] || 0) + 1;
      });

      const donationsByStatus = Object.entries(donationStatusCount).map(([name, value]) => ({ name, value }));
      const donationsByCategory = Object.entries(donationCategoryCount).map(([name, value]) => ({ name, value }));

      // ── Requests ──
      const requestStatusCount: Record<string, number> = {};
      requests.forEach((r: any) => {
        const s = r.status || "unknown";
        requestStatusCount[s] = (requestStatusCount[s] || 0) + 1;
      });
      const requestsByStatus = Object.entries(requestStatusCount).map(([name, value]) => ({ name, value }));

      // ── Ratings ──
      const ratingDist: Record<string, number> = {};
      let totalRatingSum = 0;
      ratings.forEach((r: any) => {
        const key = `${r.rating}-star`;
        ratingDist[key] = (ratingDist[key] || 0) + 1;
        totalRatingSum += r.rating;
      });
      const ratingsDistribution = Object.entries(ratingDist).map(([name, value]) => ({ name, value }));

      // ── Reports ──
      const reportStatusCount: Record<string, number> = {};
      const reportTypeCount: Record<string, number> = {};
      reports.forEach((r: any) => {
        reportStatusCount[r.status] = (reportStatusCount[r.status] || 0) + 1;
        reportTypeCount[r.type] = (reportTypeCount[r.type] || 0) + 1;
      });
      const reportsByStatus = Object.entries(reportStatusCount).map(([name, value]) => ({ name, value }));
      const reportsByType = Object.entries(reportTypeCount).map(([name, value]) => ({ name, value }));

      // ── Submissions ──
      const submissionStatusCount: Record<string, number> = {};
      const submissionOrgTypeCount: Record<string, number> = {};
      submissions.forEach((s: any) => {
        submissionStatusCount[s.status] = (submissionStatusCount[s.status] || 0) + 1;
        submissionOrgTypeCount[s.org_type_slug] = (submissionOrgTypeCount[s.org_type_slug] || 0) + 1;
      });
      const submissionsByStatus = Object.entries(submissionStatusCount).map(([name, value]) => ({ name, value }));
      const submissionsByOrgType = Object.entries(submissionOrgTypeCount).map(([name, value]) => ({ name, value }));

      // ── Time series ──
      const groupByDate = (items: any[], field: string) => {
        const map: Record<string, number> = {};
        items.forEach((item: any) => {
          const date = item[field]?.split("T")[0];
          if (date) map[date] = (map[date] || 0) + 1;
        });
        return Object.entries(map)
          .sort(([a], [b]) => a.localeCompare(b))
          .slice(-30)
          .map(([date, created]) => ({ date, created }));
      };

      const groupUsersByDate = (items: any[]) => {
        const map: Record<string, { donors: number; recipients: number }> = {};
        items.forEach((item: any) => {
          const date = item.created_at?.split("T")[0];
          if (date) {
            if (!map[date]) map[date] = { donors: 0, recipients: 0 };
            if (item.role === "donor") map[date].donors += 1;
            else if (item.role === "recipient") map[date].recipients += 1;
          }
        });
        return Object.entries(map)
          .sort(([a], [b]) => a.localeCompare(b))
          .slice(-30)
          .map(([date, counts]) => ({ date, ...counts }));
      };

      // ── Region Data (derived from main queries) ──
      const regionMap = new Map<string, RegionData>();

      const addOrInit = (loc: string) => {
        if (!loc) return;
        if (!regionMap.has(loc)) {
          regionMap.set(loc, {
            region: loc,
            donorCount: 0,
            recipientCount: 0,
            campaignCount: 0,
            donationCount: 0,
            totalGoal: 0,
            totalCollected: 0,
            avgRating: 0,
          });
        }
      };

      profiles.forEach((p: any) => {
        if (!p.location) return;
        addOrInit(p.location);
        const r = regionMap.get(p.location)!;
        if (p.role === "donor") r.donorCount += 1;
        else if (p.role === "recipient") r.recipientCount += 1;
      });

      campaigns.forEach((c: any) => {
        if (!c.location) return;
        addOrInit(c.location);
        const r = regionMap.get(c.location)!;
        r.campaignCount += 1;
        r.totalGoal += c.goal_amount || 0;
        r.totalCollected += c.collected_amount || 0;
      });

      donations.forEach((d: any) => {
        if (!d.location) return;
        addOrInit(d.location);
        const r = regionMap.get(d.location)!;
        r.donationCount += 1;
      });

      const regionData = Array.from(regionMap.values())
        .sort((a, b) => (b.donorCount + b.recipientCount) - (a.donorCount + a.recipientCount));

      // ── Financial stats ──
      const totalGoal = campaigns.reduce((sum: number, c: any) => sum + (c.goal_amount || 0), 0);
      const totalCollected = campaigns.reduce((sum: number, c: any) => sum + (c.collected_amount || 0), 0);
      const completedCampaigns = campaigns.filter((c: any) => c.status === "completed").length;
      const activeCampaigns = campaigns.filter((c: any) => c.status === "active").length;
      const pausedCampaigns = campaigns.filter((c: any) => c.status === "paused").length;
      const pendingCampaigns = campaigns.filter((c: any) => c.status === "pending").length;
      const rejectedCampaigns = campaigns.filter((c: any) => c.status === "rejected").length;
      const availableDonations = donations.filter((d: any) => d.status === "available").length;
      const claimedDonations = donations.filter((d: any) => d.status === "claimed").length;
      const completedDonationsCount = donations.filter((d: any) => d.status === "completed").length;
      const pendingDonations = donations.filter((d: any) => d.status === "pending").length;
      const rejectedDonations = donations.filter((d: any) => d.status === "rejected").length;
      const approvedRequests = requestStatusCount["approved"] || 0;
      const pendingRequests = requestStatusCount["pending"] || 0;
      const rejectedRequests = requestStatusCount["rejected"] || 0;

      setData({
        totalUsers: totalUsers || 0,
        totalDonors: totalDonors || 0,
        totalRecipients: totalRecipients || 0,
        totalAdmins: totalAdmins || 0,
        totalCampaigns: totalCampaigns || 0,
        totalDonations: totalDonations || 0,
        totalRequests: totalRequests || 0,
        totalRatings: totalRatings || 0,
        totalReports: totalReports || 0,
        totalSubmissions: totalSubmissions || 0,
        totalMessages: totalMessages || 0,

        usersByRole,
        campaignsByStatus,
        campaignsByCategory,
        campaignsByOrgType,
        donationsByStatus,
        donationsByCategory,
        requestsByStatus,
        ratingsDistribution,
        reportsByStatus,
        reportsByType,
        submissionsByStatus,
        submissionsByOrgType,
        priorityDistribution,

        campaignsOverTime: groupByDate(campaignsOverTime, "created_at"),
        donationsOverTime: groupByDate(donationsOverTime, "created_at"),
        usersOverTime: groupUsersByDate(usersOverTimeData),

        regionData,

        totalGoalAmount: totalGoal,
        totalCollectedAmount: totalCollected,
        campaignSuccessRate: (activeCampaigns + completedCampaigns) > 0
          ? Math.round((completedCampaigns / (activeCampaigns + completedCampaigns)) * 100)
          : 0,
        requestApprovalRate: requests.length > 0
          ? Math.round((approvedRequests / requests.length) * 100)
          : 0,
        averageRating: ratings.length > 0
          ? Math.round((totalRatingSum / ratings.length) * 10) / 10
          : 0,
        requestApproved: approvedRequests,
        requestPending: pendingRequests,
        requestRejected: rejectedRequests,
        campaignActive: activeCampaigns,
        campaignCompleted: completedCampaigns,
        campaignPaused: pausedCampaigns,
        campaignPending: pendingCampaigns,
        campaignRejected: rejectedCampaigns,
        donationAvailable: availableDonations,
        donationClaimed: claimedDonations,
        donationCompleted: completedDonationsCount,
        donationPending: pendingDonations,
        donationRejected: rejectedDonations,
      });
    } catch (err) {
      console.error("Analytics fetch error:", err);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [buildFilterQuery, buildSelectQuery]);

  useEffect(() => {
    fetchData(true);
  }, [fetchData]);

  const resetFilters = () => {
    setFilters(defaultFilters);
  };

  const hasActiveFilters = useMemo(() => {
    return Object.values(filters).some((v) => v !== "");
  }, [filters]);

  const exportToExcel = async () => {
    if (!data) return;
    setExporting(true);
    try {
      const wb = XLSX.utils.book_new();

      const [
        profilesRes,
        campaignsRes,
        donationsRes,
        requestsRes,
        ratingsRes,
        reportsRes,
        submissionsRes,
      ] = await Promise.all([
        buildSelectQuery("profiles", "*"),
        buildSelectQuery("campaigns", "*, profiles:recipient_id(full_name, email, role)"),
        buildSelectQuery("donations", "*, profiles:donor_id(full_name, email)"),
        buildSelectQuery("requests", "*, profiles:recipient_id(full_name, email)"),
        buildSelectQuery("ratings", "*, profiles:recipient_id(full_name, email)"),
        buildSelectQuery("reports", "*, profiles:reporter_id(full_name, email)"),
        buildSelectQuery("verification_submissions", "*"),
      ]);

      const flatten = (arr: any[]) => arr?.map((item: any) => {
        const flat: Record<string, any> = {};
        Object.entries(item).forEach(([key, val]) => {
          if (val !== null && typeof val === "object" && !Array.isArray(val) && !(val instanceof Date)) {
            Object.entries(val as Record<string, any>).forEach(([k, v]) => {
              flat[`${key}_${k}`] = typeof v === "object" ? JSON.stringify(v) : v;
            });
          } else {
            flat[key] = Array.isArray(val) ? JSON.stringify(val) : val;
          }
        });
        return flat;
      }) || [];

      // ── Helper: style header row ──
      const styleSheet = (ws: XLSX.WorkSheet, colWidths: number[]) => {
        const range = XLSX.utils.decode_range(ws["!ref"] || "A1:A1");
        // Set column widths
        ws["!cols"] = colWidths.map((w) => ({ wch: w }));
        // Bold header row
        for (let c = range.s.c; c <= range.e.c; c++) {
          const addr = XLSX.utils.encode_cell({ r: range.s.r, c });
          if (ws[addr]) ws[addr].s = { font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11 }, fill: { fgColor: { rgb: "1F4E79" } } };
        }
        // Alternate row colors for readability
        for (let r = range.s.r + 1; r <= range.e.r; r++) {
          for (let c = range.s.c; c <= range.e.c; c++) {
            const addr = XLSX.utils.encode_cell({ r, c });
            if (ws[addr]) {
              ws[addr].s = {
                ...ws[addr].s,
                font: { sz: 10 },
                border: {
                  top: { style: "thin", color: { rgb: "D9D9D9" } },
                  bottom: { style: "thin", color: { rgb: "D9D9D9" } },
                },
              };
            }
          }
        }
      };

      // ── Sheet 1: Executive Summary ──
      const campaignsData = campaignsRes.data || [];
      const totalGoalFin = campaignsData.reduce((s: number, c: any) => s + (c.goal_amount || 0), 0);
      const totalCollectedFin = campaignsData.reduce((s: number, c: any) => s + (c.collected_amount || 0), 0);
      const completedFin = campaignsData.filter((c: any) => c.status === "completed").length;
      const activeFin = campaignsData.filter((c: any) => c.status === "active").length;
      const withGoal = campaignsData.filter((c: any) => c.goal_amount && c.goal_amount > 0);
      const donorRecipientRatio = data.totalRecipients > 0
        ? (data.totalDonors / data.totalRecipients).toFixed(2)
        : "N/A";

      const execSummary = [
        { Section: "FILTERS APPLIED", "": "", "": "", "": "" },
        { Section: "Date From", Value: filters.dateFrom || "All", "": "", "": "" },
        { Section: "Date To", Value: filters.dateTo || "All", "": "", "": "" },
        { Section: "Location", Value: filters.location || "All", "": "", "": "" },
        { Section: "Campaign Status", Value: filters.campaignStatus || "All", "": "", "": "" },
        { Section: "Donation Status", Value: filters.donationStatus || "All", "": "", "": "" },
        { Section: "User Role", Value: filters.userRole || "All", "": "", "": "" },
        { Section: "", Value: "", "": "", "": "" },
        { Section: "PLATFORM OVERVIEW", "": "", "": "", "": "" },
        { Section: "Metric", Value: "Count", "": "", "": "" },
        { Section: "Total Users", Value: data.totalUsers, "": "", "": "" },
        { Section: "Total Donors", Value: data.totalDonors, "": "", "": "" },
        { Section: "Total Recipients", Value: data.totalRecipients, "": "", "": "" },
        { Section: "Total Admins", Value: data.totalAdmins, "": "", "": "" },
        { Section: "Total Campaigns", Value: data.totalCampaigns, "": "", "": "" },
        { Section: "Total Donations", Value: data.totalDonations, "": "", "": "" },
        { Section: "Total Requests", Value: data.totalRequests, "": "", "": "" },
        { Section: "Total Ratings", Value: data.totalRatings, "": "", "": "" },
        { Section: "Total Reports", Value: data.totalReports, "": "", "": "" },
        { Section: "Total Verifications", Value: data.totalSubmissions, "": "", "": "" },
        { Section: "Total Messages", Value: data.totalMessages, "": "", "": "" },
        { Section: "", Value: "", "": "", "": "" },
        { Section: "FINANCIAL KPIs", "": "", "": "", "": "" },
        { Section: "Total Goal Amount ($)", Value: totalGoalFin.toLocaleString(), "": "", "": "" },
        { Section: "Total Collected Amount ($)", Value: totalCollectedFin.toLocaleString(), "": "", "": "" },
        { Section: "Collection Rate (%)", Value: totalGoalFin > 0 ? Math.round((totalCollectedFin / totalGoalFin) * 100) : 0, "": "", "": "" },
        { Section: "Active Campaigns", Value: activeFin, "": "", "": "" },
        { Section: "Completed Campaigns", Value: completedFin, "": "", "": "" },
        { Section: "Campaign Success Rate (%)", Value: data.campaignSuccessRate, "": "", "": "" },
        { Section: "Average Rating", Value: `${data.averageRating} / 5`, "": "", "": "" },
        { Section: "Average Goal per Campaign ($)", Value: withGoal.length > 0 ? Math.round(totalGoalFin / withGoal.length).toLocaleString() : 0, "": "", "": "" },
        { Section: "Average Collected per Campaign ($)", Value: withGoal.length > 0 ? Math.round(totalCollectedFin / withGoal.length).toLocaleString() : 0, "": "", "": "" },
        { Section: "Donor/Recipient Ratio", Value: donorRecipientRatio, "": "", "": "" },
        { Section: "Request Approval Rate (%)", Value: data.requestApprovalRate, "": "", "": "" },
        { Section: "", Value: "", "": "", "": "" },
        { Section: "CAMPAIGN STATUS BREAKDOWN", "": "", "": "", "": "" },
        { Section: "Active", Value: data.campaignActive, "": "", "": "" },
        { Section: "Completed", Value: data.campaignCompleted, "": "", "": "" },
        { Section: "Pending", Value: data.campaignPending, "": "", "": "" },
        { Section: "Paused", Value: data.campaignPaused, "": "", "": "" },
        { Section: "Rejected", Value: data.campaignRejected, "": "", "": "" },
        { Section: "", Value: "", "": "", "": "" },
        { Section: "DONATION STATUS BREAKDOWN", "": "", "": "", "": "" },
        { Section: "Available", Value: data.donationAvailable, "": "", "": "" },
        { Section: "Claimed", Value: data.donationClaimed, "": "", "": "" },
        { Section: "Completed", Value: data.donationCompleted, "": "", "": "" },
        { Section: "Pending", Value: data.donationPending, "": "", "": "" },
        { Section: "Rejected", Value: data.donationRejected, "": "", "": "" },
        { Section: "", Value: "", "": "", "": "" },
        { Section: "REQUEST STATUS BREAKDOWN", "": "", "": "", "": "" },
        { Section: "Approved", Value: data.requestApproved, "": "", "": "" },
        { Section: "Pending", Value: data.requestPending, "": "", "": "" },
        { Section: "Rejected", Value: data.requestRejected, "": "", "": "" },
      ];
      const wsExec = XLSX.utils.json_to_sheet(execSummary);
      wsExec["!cols"] = [{ wch: 35 }, { wch: 30 }, { wch: 20 }, { wch: 20 }];
      XLSX.utils.book_append_sheet(wb, wsExec, "Executive Summary");

      // ── Sheet 2: Region Summary ──
      const regionSummary = data.regionData.map((r) => ({
        Region: r.region,
        "Donor Count": r.donorCount,
        "Recipient Count": r.recipientCount,
        "Total Users": r.donorCount + r.recipientCount,
        "Donor/Recipient Ratio": r.recipientCount > 0
          ? parseFloat((r.donorCount / r.recipientCount).toFixed(2))
          : "N/A",
        "Campaign Count": r.campaignCount,
        "Donation Count": r.donationCount,
        "Total Goal ($)": r.totalGoal,
        "Total Collected ($)": r.totalCollected,
        "Collection Rate (%)": r.totalGoal > 0
          ? Math.round((r.totalCollected / r.totalGoal) * 100)
          : 0,
        "Avg Goal per Campaign ($)": r.campaignCount > 0 ? Math.round(r.totalGoal / r.campaignCount) : 0,
        "Avg Collected per Campaign ($)": r.campaignCount > 0 ? Math.round(r.totalCollected / r.campaignCount) : 0,
      }));
      const wsRegion = XLSX.utils.json_to_sheet(regionSummary);
      styleSheet(wsRegion, [20, 12, 15, 12, 18, 14, 14, 16, 18, 16, 24, 28]);
      XLSX.utils.book_append_sheet(wb, wsRegion, "Region Summary");

      // ── Sheet 3: Regional Rankings ──
      if (data.regionData.length > 0) {
        const sortedByDonors = [...data.regionData].sort((a, b) => b.donorCount - a.donorCount);
        const sortedByRecipients = [...data.regionData].sort((a, b) => b.recipientCount - a.recipientCount);
        const sortedByCampaigns = [...data.regionData].sort((a, b) => b.campaignCount - a.campaignCount);
        const sortedByDonations = [...data.regionData].sort((a, b) => b.donationCount - a.donationCount);
        const sortedByUsers = [...data.regionData].sort((a, b) => (b.donorCount + b.recipientCount) - (a.donorCount + a.recipientCount));
        const sortedByCollection = [...data.regionData]
          .filter((r) => r.totalGoal > 0)
          .sort((a, b) => (b.totalCollected / b.totalGoal) - (a.totalCollected / a.totalGoal));

        const rankings = [
          { Rank: "", Category: "TOP REGIONS BY DONOR COUNT", "Region": "", "": "", "": "", "": "", "": "" },
          { Rank: "#", "Region Name": "Donor Count", "Recipient Count": "Total Users", "": "", "": "", "": "" },
          ...sortedByDonors.map((r, i) => ({
            Rank: i + 1,
            "Region Name": r.region,
            "Donor Count": r.donorCount,
            "Recipient Count": r.recipientCount,
            "Total Users": r.donorCount + r.recipientCount,
            "": "",
            "": "",
          })),
          { Rank: "", "Region Name": "", "Donor Count": "", "Recipient Count": "", "Total Users": "", "": "", "": "" },
          { Rank: "", Category: "TOP REGIONS BY RECIPIENT COUNT", "Region": "", "": "", "": "", "": "", "": "" },
          { Rank: "#", "Region Name": "Recipient Count", "Donor Count": "Total Users", "": "", "": "", "": "" },
          ...sortedByRecipients.map((r, i) => ({
            Rank: i + 1,
            "Region Name": r.region,
            "Recipient Count": r.recipientCount,
            "Donor Count": r.donorCount,
            "Total Users": r.donorCount + r.recipientCount,
            "": "",
            "": "",
          })),
          { Rank: "", "Region Name": "", "Recipient Count": "", "Donor Count": "", "Total Users": "", "": "", "": "" },
          { Rank: "", Category: "TOP REGIONS BY TOTAL USERS", "Region": "", "": "", "": "", "": "", "": "" },
          { Rank: "#", "Region Name": "Total Users", "Donors": "Recipients", "": "", "": "", "": "" },
          ...sortedByUsers.map((r, i) => ({
            Rank: i + 1,
            "Region Name": r.region,
            "Total Users": r.donorCount + r.recipientCount,
            Donors: r.donorCount,
            Recipients: r.recipientCount,
            "": "",
            "": "",
          })),
          { Rank: "", "Region Name": "", "Total Users": "", Donors: "", Recipients: "", "": "", "": "" },
          { Rank: "", Category: "TOP REGIONS BY CAMPAIGN COUNT", "Region": "", "": "", "": "", "": "", "": "" },
          { Rank: "#", "Region Name": "Campaigns", "Total Goal ($)": "Total Collected ($)", "Collection %": "", "": "", "": "" },
          ...sortedByCampaigns.map((r, i) => ({
            Rank: i + 1,
            "Region Name": r.region,
            Campaigns: r.campaignCount,
            "Total Goal ($)": r.totalGoal,
            "Total Collected ($)": r.totalCollected,
            "Collection %": r.totalGoal > 0 ? Math.round((r.totalCollected / r.totalGoal) * 100) : 0,
            "": "",
          })),
          { Rank: "", "Region Name": "", Campaigns: "", "Total Goal ($)": "", "Total Collected ($)": "", "Collection %": "", "": "" },
          { Rank: "", Category: "TOP REGIONS BY DONATION COUNT", "Region": "", "": "", "": "", "": "", "": "" },
          { Rank: "#", "Region Name": "Donations", "": "", "": "", "": "", "": "", "": "" },
          ...sortedByDonations.map((r, i) => ({
            Rank: i + 1,
            "Region Name": r.region,
            Donations: r.donationCount,
            "": "",
            "": "",
            "": "",
            "": "",
          })),
          { Rank: "", "Region Name": "", Donations: "", "": "", "": "", "": "", "": "" },
          { Rank: "", Category: "TOP REGIONS BY COLLECTION RATE", "Region": "", "": "", "": "", "": "", "": "" },
          { Rank: "#", "Region Name": "Collection %", "Goal ($)": "Collected ($)", "": "", "": "", "": "" },
          ...sortedByCollection.map((r, i) => ({
            Rank: i + 1,
            "Region Name": r.region,
            "Collection %": `${Math.round((r.totalCollected / r.totalGoal) * 100)}%`,
            "Goal ($)": r.totalGoal,
            "Collected ($)": r.totalCollected,
            "": "",
            "": "",
          })),
        ];
        const wsRankings = XLSX.utils.json_to_sheet(rankings);
        wsRankings["!cols"] = [{ wch: 6 }, { wch: 28 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 18 }, { wch: 16 }];
        XLSX.utils.book_append_sheet(wb, wsRankings, "Regional Rankings");
      }

      // ── Sheet 4: Users by Region (detailed) ──
      const profilesData = profilesRes.data || [];
      const usersByRegionMap = new Map<string, any[]>();
      profilesData.forEach((p: any) => {
        const loc = p.location || "Unknown";
        if (!usersByRegionMap.has(loc)) usersByRegionMap.set(loc, []);
        usersByRegionMap.get(loc)!.push(p);
      });
      if (usersByRegionMap.size > 0) {
        const usersByRegionRows: any[] = [];
        const sortedRegions = [...usersByRegionMap.entries()].sort((a, b) => b[1].length - a[1].length);
        sortedRegions.forEach(([region, users]) => {
          usersByRegionRows.push({ Region: region, "User Count": users.length, "": "", "": "", "": "", "": "" });
          usersByRegionRows.push({
            "": "Name",
            "": "Email",
            "": "Role",
            "": "Phone",
            "": "Status",
            "": "Joined",
          });
          users.forEach((u: any) => {
            usersByRegionRows.push({
              "": u.full_name || "",
              "": u.email || "",
              "": u.role || "",
              "": u.phone || "",
              "": u.recipient_status || "",
              "": u.created_at?.split("T")[0] || "",
            });
          });
          usersByRegionRows.push({ "": "", "": "", "": "", "": "", "": "", "": "" });
        });
        const wsUsersByRegion = XLSX.utils.json_to_sheet(usersByRegionRows);
        wsUsersByRegion["!cols"] = [{ wch: 28 }, { wch: 22 }, { wch: 30 }, { wch: 16 }, { wch: 16 }, { wch: 16 }];
        XLSX.utils.book_append_sheet(wb, wsUsersByRegion, "Users by Region");
      }

      // ── Sheet 5: Campaigns by Region (detailed) ──
      const campaignsFull = campaignsRes.data || [];
      const campaignsByRegionMap = new Map<string, any[]>();
      campaignsFull.forEach((c: any) => {
        const loc = c.location || "Unknown";
        if (!campaignsByRegionMap.has(loc)) campaignsByRegionMap.set(loc, []);
        campaignsByRegionMap.get(loc)!.push(c);
      });
      if (campaignsByRegionMap.size > 0) {
        const campByRegionRows: any[] = [];
        const sortedCampRegions = [...campaignsByRegionMap.entries()].sort((a, b) => b[1].length - a[1].length);
        sortedCampRegions.forEach(([region, camps]) => {
          campByRegionRows.push({ Region: region, "Campaign Count": camps.length, "Total Goal ($)": camps.reduce((s: number, c: any) => s + (c.goal_amount || 0), 0), "Total Collected ($)": camps.reduce((s: number, c: any) => s + (c.collected_amount || 0), 0), "": "", "": "", "": "" });
          campByRegionRows.push({
            "": "Title",
            "": "Category",
            "": "Status",
            "": "Goal ($)",
            "": "Collected ($)",
            "": "Priority",
            "": "Created",
          });
          camps.forEach((c: any) => {
            const recipientName = c.profiles?.full_name || "";
            campByRegionRows.push({
              "": c.title || "",
              "": c.category || "",
              "": c.status || "",
              "": c.goal_amount || 0,
              "": c.collected_amount || 0,
              "": c.priority_level || "",
              "": c.created_at?.split("T")[0] || "",
            });
          });
          campByRegionRows.push({ "": "", "": "", "": "", "": "", "": "", "": "", "": "" });
        });
        const wsCampByRegion = XLSX.utils.json_to_sheet(campByRegionRows);
        wsCampByRegion["!cols"] = [{ wch: 28 }, { wch: 22 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 16 }, { wch: 28 }];
        XLSX.utils.book_append_sheet(wb, wsCampByRegion, "Campaigns by Region");
      }

      // ── Sheet 6: Donations by Region (detailed) ──
      const donationsFull = donationsRes.data || [];
      const donationsByRegionMap = new Map<string, any[]>();
      donationsFull.forEach((d: any) => {
        const loc = d.location || "Unknown";
        if (!donationsByRegionMap.has(loc)) donationsByRegionMap.set(loc, []);
        donationsByRegionMap.get(loc)!.push(d);
      });
      if (donationsByRegionMap.size > 0) {
        const donByRegionRows: any[] = [];
        const sortedDonRegions = [...donationsByRegionMap.entries()].sort((a, b) => b[1].length - a[1].length);
        sortedDonRegions.forEach(([region, dons]) => {
          donByRegionRows.push({ Region: region, "Donation Count": dons.length, "": "", "": "", "": "", "": "" });
          donByRegionRows.push({
            "": "Title",
            "": "Category",
            "": "Status",
            "": "Description",
            "": "Donor",
            "": "Created",
          });
          dons.forEach((d: any) => {
            const donorName = d.profiles?.full_name || "";
            donByRegionRows.push({
              "": d.title || "",
              "": d.category || "",
              "": d.status || "",
              "": (d.description || "").substring(0, 100),
              "": donorName,
              "": d.created_at?.split("T")[0] || "",
            });
          });
          donByRegionRows.push({ "": "", "": "", "": "", "": "", "": "", "": "" });
        });
        const wsDonByRegion = XLSX.utils.json_to_sheet(donByRegionRows);
        wsDonByRegion["!cols"] = [{ wch: 28 }, { wch: 22 }, { wch: 18 }, { wch: 18 }, { wch: 40 }, { wch: 28 }];
        XLSX.utils.book_append_sheet(wb, wsDonByRegion, "Donations by Region");
      }

      // ── Sheet 7: Campaign Time Series ──
      if (data.campaignsOverTime.length > 0) {
        const campaignTimeSeries = data.campaignsOverTime.map((d) => ({
          Date: d.date,
          "Campaigns Created": d.created,
        }));
        const wsCampTS = XLSX.utils.json_to_sheet(campaignTimeSeries);
        styleSheet(wsCampTS, [16, 20]);
        XLSX.utils.book_append_sheet(wb, wsCampTS, "Campaigns Over Time");
      }

      // ── Sheet 8: Donation Time Series ──
      if (data.donationsOverTime.length > 0) {
        const donationTimeSeries = data.donationsOverTime.map((d) => ({
          Date: d.date,
          "Donations Created": d.created,
        }));
        const wsDonTS = XLSX.utils.json_to_sheet(donationTimeSeries);
        styleSheet(wsDonTS, [16, 20]);
        XLSX.utils.book_append_sheet(wb, wsDonTS, "Donations Over Time");
      }

      // ── Sheet 9: User Registration Trends ──
      if (data.usersOverTime.length > 0) {
        const userTimeSeries = data.usersOverTime.map((d) => ({
          Date: d.date,
          "Donors Registered": d.donors,
          "Recipients Registered": d.recipients,
          "Total Registered": d.donors + d.recipients,
        }));
        const wsUserTS = XLSX.utils.json_to_sheet(userTimeSeries);
        styleSheet(wsUserTS, [16, 20, 24, 20]);
        XLSX.utils.book_append_sheet(wb, wsUserTS, "Users Over Time");
      }

      // ── Data sheets: Full raw data ──
      const sheetConfigs: { name: string; data: any[]; colWidths: number[] }[] = [
        { name: "Profiles", data: profilesRes.data || [], colWidths: [36, 30, 16, 20, 10, 14, 30, 14] },
        { name: "Campaigns", data: campaignsRes.data || [], colWidths: [36, 30, 40, 40, 16, 20, 20, 30, 16, 14, 20, 20, 14, 20, 20] },
        { name: "Donations", data: donationsRes.data || [], colWidths: [36, 36, 30, 40, 16, 20, 30, 16, 14] },
        { name: "Requests", data: requestsRes.data || [], colWidths: [36, 36, 36, 40, 14, 16, 14] },
        { name: "Ratings", data: ratingsRes.data || [], colWidths: [36, 36, 36, 14, 40, 16] },
        { name: "Reports", data: reportsRes.data || [], colWidths: [36, 36, 36, 14, 30, 40, 14, 16] },
        { name: "Verifications", data: submissionsRes.data || [], colWidths: [36, 16, 20, 14, 60, 14] },
      ];

      sheetConfigs.forEach(({ name, data: rows, colWidths }) => {
        if (rows.length > 0) {
          const flat = flatten(rows);
          // Get all unique keys in order
          const keys = [...new Set(flat.flatMap(Object.keys))];
          const ordered = flat.map((row: any) => {
            const obj: Record<string, any> = {};
            keys.forEach((k) => { obj[k] = row[k] ?? ""; });
            return obj;
          });
          const ws = XLSX.utils.json_to_sheet(ordered);
          ws["!cols"] = colWidths.map((w) => ({ wch: w }));
          // Bold header
          const range = XLSX.utils.decode_range(ws["!ref"] || "A1:A1");
          for (let c = range.s.c; c <= range.e.c; c++) {
            const addr = XLSX.utils.encode_cell({ r: range.s.r, c });
            if (ws[addr]) {
              ws[addr].s = {
                font: { bold: true, color: { rgb: "FFFFFF" }, sz: 11 },
                fill: { fgColor: { rgb: "1F4E79" } },
                alignment: { horizontal: "center", vertical: "center" },
                border: {
                  top: { style: "thin", color: { rgb: "1F4E79" } },
                  bottom: { style: "thin", color: { rgb: "1F4E79" } },
                  left: { style: "thin", color: { rgb: "1F4E79" } },
                  right: { style: "thin", color: { rgb: "1F4E79" } },
                },
              };
            }
          }
          // Alternate row colors
          for (let r = range.s.r + 1; r <= range.e.r; r++) {
            for (let c = range.s.c; c <= range.e.c; c++) {
              const addr = XLSX.utils.encode_cell({ r, c });
              if (ws[addr]) {
                ws[addr].s = {
                  font: { sz: 10 },
                  fill: r % 2 === 0 ? { fgColor: { rgb: "F2F7FB" } } : { fgColor: { rgb: "FFFFFF" } },
                  border: {
                    top: { style: "thin", color: { rgb: "D9D9D9" } },
                    bottom: { style: "thin", color: { rgb: "D9D9D9" } },
                    left: { style: "thin", color: { rgb: "D9D9D9" } },
                    right: { style: "thin", color: { rgb: "D9D9D9" } },
                  },
                };
              }
            }
          }
          XLSX.utils.book_append_sheet(wb, ws, name);
        }
      });

      const filename = filters.location
        ? `DonationVerify_Analytics_${filters.location.replace(/[^a-zA-Z0-9]/g, "_")}_${new Date().toISOString().split("T")[0]}.xlsx`
        : `DonationVerify_Analytics_${new Date().toISOString().split("T")[0]}.xlsx`;
      XLSX.writeFile(wb, filename);
    } catch (err) {
      console.error("Export error:", err);
    } finally {
      setExporting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <p className="text-gray-500 text-lg">Failed to load analytics data</p>
      </div>
    );
  }

  const StatCard = ({ label, value, color, large, subtitle }: { label: string; value: number | string; color?: string; large?: boolean; subtitle?: string }) => (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-100 ${large ? "p-8" : "p-6"}`}>
      <p className="text-sm font-medium text-gray-500 mb-1">{label}</p>
      <p className={`${large ? "text-4xl" : "text-3xl"} font-bold ${color ? `text-${color}-600` : "text-gray-900"}`}>
        {typeof value === "number" ? value.toLocaleString() : value}
      </p>
      {subtitle && <p className="text-xs text-gray-400 mt-1">{subtitle}</p>}
    </div>
  );

  const ChartCard = ({ title, children, className }: { title: string; children: React.ReactNode; className?: string }) => (
    <div className={`bg-white rounded-xl shadow-sm border border-gray-100 p-6 ${className || ""}`}>
      <h3 className="text-lg font-semibold text-gray-900 mb-4">{title}</h3>
      {children}
    </div>
  );

  const renderPieChart = (data: { name: string; value: number }[], height = 280) => {
    if (!data || data.length === 0) return null;
    return (
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie data={data} cx="50%" cy="50%" innerRadius={60} outerRadius={100} dataKey="value" label={({ name, value }) => `${name}: ${value}`}>
            {data.map((_, i) => (
              <Cell key={i} fill={COLORS[i % COLORS.length]} />
            ))}
          </Pie>
          <Tooltip />
        </PieChart>
      </ResponsiveContainer>
    );
  };

  const renderBarChart = (data: { name: string; value: number }[], height = 280, layout: "vertical" | "horizontal" = "horizontal") => {
    if (!data || data.length === 0) return null;
    return (
      <ResponsiveContainer width="100%" height={height}>
        {layout === "horizontal" ? (
          <BarChart data={data}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="name" />
            <YAxis />
            <Tooltip />
            <Bar dataKey="value" radius={[4, 4, 0, 0]}>
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        ) : (
          <BarChart data={data} layout="vertical" margin={{ left: 10, right: 20, top: 5, bottom: 5 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis type="number" />
            <YAxis type="category" dataKey="name" width={150} tick={{ fontSize: 11 }} />
            <Tooltip />
            <Bar dataKey="value" radius={[0, 4, 4, 0]}>
              {data.map((_, i) => (
                <Cell key={i} fill={COLORS[i % COLORS.length]} />
              ))}
            </Bar>
          </BarChart>
        )}
      </ResponsiveContainer>
    );
  };

  return (
    <div className="min-h-screen bg-gray-50">
      <AdminNav />
      {refreshing && (
        <div className="h-1 bg-blue-100">
          <div className="h-full bg-blue-600 animate-pulse" style={{ width: "100%" }} />
        </div>
      )}
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Analytics Dashboard</h1>
            <p className="text-gray-500 mt-1">Complete overview of all platform data</p>
          </div>
          <div className="flex gap-3">
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={`flex items-center gap-2 px-4 py-2.5 border rounded-lg transition-colors font-medium ${
                hasActiveFilters
                  ? "bg-blue-50 border-blue-300 text-blue-700"
                  : "bg-white border-gray-300 text-gray-700 hover:bg-gray-50"
              }`}
            >
              <Filter size={18} />
              Filters
              {hasActiveFilters && (
                <span className="bg-blue-600 text-white text-xs rounded-full w-5 h-5 flex items-center justify-center">
                  {Object.values(filters).filter((v) => v !== "").length}
                </span>
              )}
            </button>
            <button
              onClick={exportToExcel}
              disabled={exporting}
              className="flex items-center gap-2 px-5 py-2.5 bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-50 transition-colors font-medium"
            >
              <Download size={18} />
              {exporting ? "Exporting..." : "Export to Excel"}
            </button>
          </div>
        </div>

        {/* Filters Panel */}
        {showFilters && (
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6 mb-6">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">Filter Data</h3>
              <button onClick={resetFilters} className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                Reset All
              </button>
            </div>
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date From</label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => setFilters({ ...filters, dateFrom: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date To</label>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => setFilters({ ...filters, dateTo: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Location/Region</label>
                <select
                  value={filters.location}
                  onChange={(e) => setFilters({ ...filters, location: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Locations</option>
                  {allLocations.map((loc) => (
                    <option key={loc} value={loc}>{loc}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Campaign Status</label>
                <select
                  value={filters.campaignStatus}
                  onChange={(e) => setFilters({ ...filters, campaignStatus: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Statuses</option>
                  <option value="active">Active</option>
                  <option value="pending">Pending</option>
                  <option value="completed">Completed</option>
                  <option value="paused">Paused</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Donation Status</label>
                <select
                  value={filters.donationStatus}
                  onChange={(e) => setFilters({ ...filters, donationStatus: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Statuses</option>
                  <option value="available">Available</option>
                  <option value="pending">Pending</option>
                  <option value="claimed">Claimed</option>
                  <option value="completed">Completed</option>
                  <option value="rejected">Rejected</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">User Role</label>
                <select
                  value={filters.userRole}
                  onChange={(e) => setFilters({ ...filters, userRole: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">All Roles</option>
                  <option value="donor">Donor</option>
                  <option value="recipient">Recipient</option>
                  <option value="admin">Admin</option>
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Overview Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <StatCard label="Total Users" value={data.totalUsers} color="blue" large />
          <StatCard label="Campaigns" value={data.totalCampaigns} color="emerald" large />
          <StatCard label="Donations" value={data.totalDonations} color="amber" large />
          <StatCard label="Verifications" value={data.totalSubmissions} color="purple" large />
          <StatCard label="Reports" value={data.totalReports} color="red" large />
        </div>

        {/* Secondary Stats */}
        <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
          <StatCard label="Donors" value={data.totalDonors} color="indigo" subtitle={`${data.totalUsers > 0 ? Math.round((data.totalDonors / data.totalUsers) * 100) : 0}% of users`} />
          <StatCard label="Recipients" value={data.totalRecipients} color="emerald" subtitle={`${data.totalUsers > 0 ? Math.round((data.totalRecipients / data.totalUsers) * 100) : 0}% of users`} />
          <StatCard label="Admins" value={data.totalAdmins} color="purple" subtitle={`${data.totalUsers > 0 ? Math.round((data.totalAdmins / data.totalUsers) * 100) : 0}% of users`} />
          <StatCard label="Requests" value={data.totalRequests} color="amber" subtitle={`Approved: ${data.requestApproved}`} />
          <StatCard label="Ratings" value={data.totalRatings} color="pink" subtitle={`Avg: ${data.averageRating} / 5`} />
        </div>

        {/* Filter Status */}
        {hasActiveFilters && (
          <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-3 mb-6 flex items-center gap-2 text-sm text-blue-800">
            <Filter size={16} />
            <span>Showing data filtered by: </span>
            {Object.entries(filters).filter(([, v]) => v !== "").map(([key, val]) => (
              <span key={key} className="bg-blue-100 px-2 py-0.5 rounded font-medium">
                {key.replace(/([A-Z])/g, " $1").replace(/^./, (s) => s.toUpperCase())}: {val}
              </span>
            ))}
          </div>
        )}

        {/* Financial KPIs */}
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Financial KPIs</h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <StatCard label="Total Goal Amount" value={`$${(data.totalGoalAmount || 0).toLocaleString()}`} color="blue" large />
            <StatCard label="Total Collected" value={`$${(data.totalCollectedAmount || 0).toLocaleString()}`} color="emerald" large />
            <StatCard label="Campaign Success Rate" value={`${data.campaignSuccessRate}%`} color="amber" large />
            <StatCard label="Request Approval Rate" value={`${data.requestApprovalRate}%`} color="purple" large />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-4">
            <StatCard label="Avg Goal per Campaign" value={`$${Math.round((data.totalGoalAmount || 0) / Math.max(data.totalCampaigns, 1)).toLocaleString()}`} color="cyan" />
            <StatCard label="Avg Collected per Campaign" value={`$${Math.round((data.totalCollectedAmount || 0) / Math.max(data.totalCampaigns, 1)).toLocaleString()}`} color="orange" />
            <StatCard label="Available Donations" value={data.donationAvailable.toLocaleString()} color="green" />
            <StatCard label="Completed Donations" value={data.donationCompleted.toLocaleString()} color="indigo" />
          </div>
        </div>

        {/* Goal vs Collected */}
        <div className="mb-8">
          <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-6">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">Goal vs Collected</h3>
            <ResponsiveContainer width="100%" height={120}>
              <BarChart data={[{ name: "Amount", goal: data.totalGoalAmount || 0, collected: data.totalCollectedAmount || 0 }]} layout="vertical">
                <CartesianGrid strokeDasharray="3 3" horizontal={false} />
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" hide />
                <Tooltip />
                <Bar dataKey="goal" fill={CHART_COLORS.primary} radius={[0, 4, 4, 0]} name="Goal" />
                <Bar dataKey="collected" fill={CHART_COLORS.success} radius={[0, 4, 4, 0]} name="Collected" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Region Analysis Section */}
        {data.regionData.length > 0 && (
          <div className="mb-8">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Regional / Location Analysis</h2>

            {/* Region Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
              <StatCard label="Total Regions" value={data.regionData.length} color="blue" />
              <StatCard
                label="Top Region (Donors)"
                value={data.regionData[0]?.region || "N/A"}
                color="indigo"
                subtitle={`${data.regionData[0]?.donorCount || 0} donors`}
              />
              <StatCard
                label="Top Region (Recipients)"
                value={[...data.regionData].sort((a, b) => b.recipientCount - a.recipientCount)[0]?.region || "N/A"}
                color="emerald"
              />
              <StatCard
                label="Region with Most Campaigns"
                value={[...data.regionData].sort((a, b) => b.campaignCount - a.campaignCount)[0]?.region || "N/A"}
                color="amber"
              />
            </div>

            {/* Region Table */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden mb-6">
              <div className="px-6 py-4 border-b border-gray-100">
                <h3 className="text-lg font-semibold text-gray-900">All Regions Breakdown</h3>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="bg-gray-50 border-b border-gray-100">
                      <th className="text-left px-6 py-3 font-medium text-gray-600">Region</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Donors</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Recipients</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Total Users</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">D/R Ratio</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Campaigns</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Donations</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Goal ($)</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Collected ($)</th>
                      <th className="text-right px-4 py-3 font-medium text-gray-600">Collection %</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.regionData.map((r, i) => (
                      <tr key={r.region} className={`border-b border-gray-50 ${i % 2 === 0 ? "bg-white" : "bg-gray-50/50"}`}>
                        <td className="px-6 py-3 font-medium text-gray-900">{r.region}</td>
                        <td className="text-right px-4 py-3 text-blue-600 font-medium">{r.donorCount}</td>
                        <td className="text-right px-4 py-3 text-emerald-600 font-medium">{r.recipientCount}</td>
                        <td className="text-right px-4 py-3 text-gray-900 font-medium">{r.donorCount + r.recipientCount}</td>
                        <td className="text-right px-4 py-3 text-gray-600">
                          {r.recipientCount > 0 ? (r.donorCount / r.recipientCount).toFixed(2) : "—"}
                        </td>
                        <td className="text-right px-4 py-3 text-amber-600 font-medium">{r.campaignCount}</td>
                        <td className="text-right px-4 py-3 text-purple-600 font-medium">{r.donationCount}</td>
                        <td className="text-right px-4 py-3 text-gray-900">${r.totalGoal.toLocaleString()}</td>
                        <td className="text-right px-4 py-3 text-green-600">${r.totalCollected.toLocaleString()}</td>
                        <td className="text-right px-4 py-3 text-gray-900">
                          {r.totalGoal > 0 ? Math.round((r.totalCollected / r.totalGoal) * 100) : 0}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Region Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <ChartCard title="Top Regions by Total Users">
                {renderBarChart(
                  data.regionData.slice(0, 10).map((r) => ({ name: r.region, value: r.donorCount + r.recipientCount })),
                  300, "vertical"
                )}
              </ChartCard>
              <ChartCard title="Top Regions by Donor Count">
                {renderBarChart(
                  [...data.regionData].sort((a, b) => b.donorCount - a.donorCount).slice(0, 10).map((r) => ({ name: r.region, value: r.donorCount })),
                  300, "vertical"
                )}
              </ChartCard>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <ChartCard title="Top Regions by Recipient Count">
                {renderBarChart(
                  [...data.regionData].sort((a, b) => b.recipientCount - a.recipientCount).slice(0, 10).map((r) => ({ name: r.region, value: r.recipientCount })),
                  300, "vertical"
                )}
              </ChartCard>
              <ChartCard title="Top Regions by Campaign Count">
                {renderBarChart(
                  [...data.regionData].sort((a, b) => b.campaignCount - a.campaignCount).slice(0, 10).map((r) => ({ name: r.region, value: r.campaignCount })),
                  300, "vertical"
                )}
              </ChartCard>
            </div>
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              <ChartCard title="Top Regions by Donation Count">
                {renderBarChart(
                  [...data.regionData].sort((a, b) => b.donationCount - a.donationCount).slice(0, 10).map((r) => ({ name: r.region, value: r.donationCount })),
                  300, "vertical"
                )}
              </ChartCard>
              <ChartCard title="Regions by Collection Rate">
                {renderBarChart(
                  [...data.regionData]
                    .filter((r) => r.totalGoal > 0)
                    .sort((a, b) => (b.totalCollected / b.totalGoal) - (a.totalCollected / a.totalGoal))
                    .slice(0, 10)
                    .map((r) => ({
                      name: r.region,
                      value: Math.round((r.totalCollected / r.totalGoal) * 100),
                    })),
                  300, "vertical"
                )}
              </ChartCard>
            </div>
          </div>
        )}

        {/* Charts Row 1: Users + Campaigns */}
        {(data.usersByRole.length > 0 || data.campaignsByStatus.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {data.usersByRole.length > 0 && (
              <ChartCard title="Users by Role">
                {renderPieChart(data.usersByRole)}
              </ChartCard>
            )}
            {data.campaignsByStatus.length > 0 && (
              <ChartCard title="Campaigns by Status">
                {renderBarChart(data.campaignsByStatus)}
              </ChartCard>
            )}
          </div>
        )}

        {/* Charts Row 2: Donations + Requests */}
        {(data.donationsByStatus.length > 0 || data.requestsByStatus.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {data.donationsByStatus.length > 0 && (
              <ChartCard title="Donations by Status">
                {renderBarChart(data.donationsByStatus)}
              </ChartCard>
            )}
            {data.requestsByStatus.length > 0 && (
              <ChartCard title="Requests by Status">
                {renderPieChart(data.requestsByStatus)}
              </ChartCard>
            )}
          </div>
        )}

        {/* Charts Row 3: Campaign Category + Org Type */}
        {(data.campaignsByCategory.length > 0 || data.campaignsByOrgType.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {data.campaignsByCategory.length > 0 && (
              <ChartCard title="Campaign Categories">
                {renderBarChart(data.campaignsByCategory, 280, "vertical")}
              </ChartCard>
            )}
            {data.campaignsByOrgType.length > 0 && (
              <ChartCard title="Campaigns by Organization Type">
                {renderPieChart(data.campaignsByOrgType)}
              </ChartCard>
            )}
          </div>
        )}

        {/* Charts Row 4: Verifications + Priority */}
        {(data.submissionsByStatus.length > 0 || data.priorityDistribution.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {data.submissionsByStatus.length > 0 && (
              <ChartCard title="Verification Submissions by Status">
                {renderBarChart(data.submissionsByStatus)}
              </ChartCard>
            )}
            {data.priorityDistribution.length > 0 && (
              <ChartCard title="Priority Score Distribution">
                {renderPieChart(data.priorityDistribution)}
              </ChartCard>
            )}
          </div>
        )}

        {/* Charts Row 5: Submissions by Org + Reports */}
        {(data.submissionsByOrgType.length > 0 || data.reportsByStatus.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {data.submissionsByOrgType.length > 0 && (
              <ChartCard title="Verification Submissions by Org Type">
                {renderBarChart(data.submissionsByOrgType, 300, "vertical")}
              </ChartCard>
            )}
            {data.reportsByStatus.length > 0 && (
              <ChartCard title="Reports by Status">
                {renderPieChart(data.reportsByStatus)}
              </ChartCard>
            )}
          </div>
        )}

        {/* Charts Row 6: Donation Categories + Ratings */}
        {(data.donationsByCategory.length > 0 || data.ratingsDistribution.length > 0) && (
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
            {data.donationsByCategory.length > 0 && (
              <ChartCard title="Donation Categories">
                {renderBarChart(data.donationsByCategory, 280, "vertical")}
              </ChartCard>
            )}
            {data.ratingsDistribution.length > 0 && (
              <ChartCard title="Ratings Distribution">
                {renderBarChart(data.ratingsDistribution)}
              </ChartCard>
            )}
          </div>
        )}

        {/* Detailed Campaign / Donation / Request Status Breakdown */}
        {data.totalCampaigns > 0 || data.totalDonations > 0 || data.totalRequests > 0 ? (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
            {data.totalCampaigns > 0 && (
            <ChartCard title="Campaign Status Breakdown">
            <div className="space-y-3">
              {[
                { label: "Active", value: data.campaignActive, color: "text-green-600", bg: "bg-green-100" },
                { label: "Completed", value: data.campaignCompleted, color: "text-blue-600", bg: "bg-blue-100" },
                { label: "Pending", value: data.campaignPending, color: "text-yellow-600", bg: "bg-yellow-100" },
                { label: "Paused", value: data.campaignPaused, color: "text-orange-600", bg: "bg-orange-100" },
                { label: "Rejected", value: data.campaignRejected, color: "text-red-600", bg: "bg-red-100" },
              ].map((item) => (
                <div key={item.label} className="flex justify-between items-center">
                  <span className="text-gray-600">{item.label}</span>
                  <span className={`font-bold ${item.color} ${item.bg} px-3 py-1 rounded-full text-sm`}>
                    {item.value.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </ChartCard>
            )}
            {data.totalDonations > 0 && (
          <ChartCard title="Donation Status Breakdown">
            <div className="space-y-3">
              {[
                { label: "Available", value: data.donationAvailable, color: "text-green-600", bg: "bg-green-100" },
                { label: "Claimed", value: data.donationClaimed, color: "text-blue-600", bg: "bg-blue-100" },
                { label: "Completed", value: data.donationCompleted, color: "text-indigo-600", bg: "bg-indigo-100" },
                { label: "Pending", value: data.donationPending, color: "text-yellow-600", bg: "bg-yellow-100" },
                { label: "Rejected", value: data.donationRejected, color: "text-red-600", bg: "bg-red-100" },
              ].map((item) => (
                <div key={item.label} className="flex justify-between items-center">
                  <span className="text-gray-600">{item.label}</span>
                  <span className={`font-bold ${item.color} ${item.bg} px-3 py-1 rounded-full text-sm`}>
                    {item.value.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </ChartCard>
            )}
            {data.totalRequests > 0 && (
          <ChartCard title="Request Status Breakdown">
            <div className="space-y-3">
              {[
                { label: "Approved", value: data.requestApproved, color: "text-green-600", bg: "bg-green-100" },
                { label: "Pending", value: data.requestPending, color: "text-yellow-600", bg: "bg-yellow-100" },
                { label: "Rejected", value: data.requestRejected, color: "text-red-600", bg: "bg-red-100" },
              ].map((item) => (
                <div key={item.label} className="flex justify-between items-center">
                  <span className="text-gray-600">{item.label}</span>
                  <span className={`font-bold ${item.color} ${item.bg} px-3 py-1 rounded-full text-sm`}>
                    {item.value.toLocaleString()}
                  </span>
                </div>
              ))}
            </div>
          </ChartCard>
            )}
          </div>
        ) : null}

        {/* Reports & Quick Stats */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          {data.reportsByType.length > 0 && (
          <ChartCard title="Reports by Type">
            {renderBarChart(data.reportsByType)}
          </ChartCard>
          )}

          <ChartCard title="Quick Stats">
            <div className="space-y-4 py-4">
              <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                <span className="text-gray-600">Total Users</span>
                <span className="text-xl font-bold text-gray-900">{data.totalUsers.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                <span className="text-gray-600">Donors</span>
                <span className="text-xl font-bold text-blue-600">{data.totalDonors.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                <span className="text-gray-600">Recipients</span>
                <span className="text-xl font-bold text-emerald-600">{data.totalRecipients.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                <span className="text-gray-600">Average Rating</span>
                <span className="text-xl font-bold text-amber-600">{data.averageRating} / 5</span>
              </div>
              <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                <span className="text-gray-600">Campaigns Created</span>
                <span className="text-xl font-bold text-indigo-600">{data.totalCampaigns.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                <span className="text-gray-600">Donations Created</span>
                <span className="text-xl font-bold text-orange-600">{data.totalDonations.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                <span className="text-gray-600">Requests Made</span>
                <span className="text-xl font-bold text-purple-600">{data.totalRequests.toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                <span className="text-gray-600">Total Goal Amount</span>
                <span className="text-xl font-bold text-gray-900">${(data.totalGoalAmount || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                <span className="text-gray-600">Total Collected</span>
                <span className="text-xl font-bold text-green-600">${(data.totalCollectedAmount || 0).toLocaleString()}</span>
              </div>
              <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                <span className="text-gray-600">Donor/Recipient Ratio</span>
                <span className="text-xl font-bold text-gray-900">
                  {data.totalRecipients > 0
                    ? (data.totalDonors / data.totalRecipients).toFixed(2)
                    : "—"}
                </span>
              </div>
              <div className="flex justify-between items-center border-b border-gray-100 pb-3">
                <span className="text-gray-600">Campaign Success Rate</span>
                <span className="text-xl font-bold text-emerald-600">{data.campaignSuccessRate}%</span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-gray-600">Request Approval Rate</span>
                <span className="text-xl font-bold text-purple-600">{data.requestApprovalRate}%</span>
              </div>
            </div>
          </ChartCard>
        </div>

        {/* Time Series */}
        {(data.campaignsOverTime.length > 0 || data.donationsOverTime.length > 0 || data.usersOverTime.length > 0) && (
        <div className="mb-8">
          <h2 className="text-xl font-bold text-gray-900 mb-4">Trends Over Time</h2>
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            {data.campaignsOverTime.length > 0 && (
            <ChartCard title="Campaigns Created (Last 30 Days)">
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={data.campaignsOverTime}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="created" stroke={CHART_COLORS.primary} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
            )}

            {data.donationsOverTime.length > 0 && (
            <ChartCard title="Donations Created (Last 30 Days)">
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={data.donationsOverTime}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis />
                  <Tooltip />
                  <Line type="monotone" dataKey="created" stroke={CHART_COLORS.success} strokeWidth={2} dot={false} />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
            )}

            {data.usersOverTime.length > 0 && (
            <ChartCard title="Users Registered (Last 30 Days)">
              <ResponsiveContainer width="100%" height={250}>
                <LineChart data={data.usersOverTime}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 10 }} />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  <Line type="monotone" dataKey="donors" stroke={CHART_COLORS.primary} strokeWidth={2} dot={false} name="Donors" />
                  <Line type="monotone" dataKey="recipients" stroke={CHART_COLORS.success} strokeWidth={2} dot={false} name="Recipients" />
                </LineChart>
              </ResponsiveContainer>
            </ChartCard>
            )}
          </div>
        </div>
        )}
      </div>
    </div>
  );
}
