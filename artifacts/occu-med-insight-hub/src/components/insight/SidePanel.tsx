import { X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import type { LocationRecord } from "@/data/types";

export function SidePanel({ location, onClose }: { location?: LocationRecord; onClose: () => void }) {
  return (
    <AnimatePresence mode="wait">
      {location ? (
        <motion.aside
          key={location.id}
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.22 }}
          className="mb-4 rounded-[24px] border border-cyan-100/16 bg-[#06111d]/72 p-5 shadow-[inset_0_0_44px_rgba(45,212,191,.06)] backdrop-blur-xl"
        >
          <button onClick={onClose} className="float-right rounded-full border border-cyan-100/10 p-2 text-cyan-100/60 hover:text-white"><X size={15} /></button>
          <p className="text-xs uppercase tracking-[0.25em] text-emerald-200/60">Location detail</p>
          <h3 className="mt-3 pr-8 text-2xl font-black text-white">{location.city}</h3>
          <p className="mt-1 text-sm text-cyan-100/55">{location.country}</p>
          <div className="mt-5 space-y-3 text-sm">
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
