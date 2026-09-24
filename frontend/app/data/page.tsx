import RegionalDataView from "@/components/data/RegionalDataView";

export const metadata = {
  title: "Regional Data — AgriVision",
  description: "Public, read-only aggregated crop-disease data by region — AgriVision's shareable agri-data layer.",
};

export default function DataPage() {
  return <RegionalDataView />;
}
