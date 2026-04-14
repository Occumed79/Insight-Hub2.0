import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { LocationRecord } from "@/data/types";

export function SidePanel({ location, onClose }: { location?: LocationRecord; onClose: () => void }) {
  return (
    <AnimatePresence>
      {location ? (
        <motion.aside initial={{ x: 360, opacity: 0 }} animate={{ x: 0, opacity: 1 }} exit={{ x: 360, opacity: 0 }} transition={{ duration: 0.28 }} className="fixed right-5 top-5 z-50 w-[340px] rounded-[28px] border border-cyan-100/20 bg-[#06111d]/90 p-6 shadow-[0_24px_90px_rgba(0,0,0,.45)] backdrop-blur-2xl">
          <button onClick={onClose} className="absolute right-4 top-4 rounded-full border border-cyan-100/10 p-2 text-cyan-100/60 hover:text-white"><X size={16} /></button>
          <p className="text-xs uppercase tracking-[0.25em] text-emerald-200/60">Location detail</p>
          <h3 className="mt-3 text-2xl font-black text-white">{location.city}</h3>
          <p className="mt-1 text-sm text-cyan-100/55">{location.country}</p>
          <div className="mt-6 space-y-4 text-sm">
            <Info label="Company" value={location.company} />
            <Info label="Region" value={location.region} />
            <Info label="Facility Type" value={location.facilityType} />
            <Info label="Activity" value={location.activity} />
            <Info label="Notes" value={location.notes} />
          </div>
        </motion.aside>
      ) : null}
    </AnimatePresence>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return <div><p className="text-[10px] uppercase tracking-[0.22em] text-cyan-100/35">{label}</p><p className="mt-1 leading-6 text-cyan-50/82">{value}</p></div>;
}
