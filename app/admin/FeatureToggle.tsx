"use client";

import { useState } from "react";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

export function FeatureToggle({ 
  featureName, 
  initialState 
}: { 
  featureName: string; 
  initialState: boolean;
}) {
  const [isEnabled, setIsEnabled] = useState(initialState);
  const [isUpdating, setIsUpdating] = useState(false);
  const router = useRouter();

  const toggleFeature = async () => {
    setIsUpdating(true);
    const newState = !isEnabled;
    setIsEnabled(newState); // Optimistic UI update

    try {
      const supabase = createClient();
      const { error } = await supabase
        .from("feature_flags")
        .update({ is_enabled: newState })
        .eq("feature_name", featureName);

      if (error) throw error;
      
      router.refresh();
    } catch (err) {
      console.error("Failed to update feature flag", err);
      // Revert on error
      setIsEnabled(!newState);
      alert("Failed to update feature flag. Check permissions.");
    } finally {
      setIsUpdating(false);
    }
  };

  return (
    <div className="flex items-center justify-between p-4 bg-white/5 border border-white/10 rounded-xl">
      <div>
        <h3 className="font-medium text-white tracking-wide">{featureName}</h3>
        <p className="text-xs text-neutral-400 mt-1">
          {isEnabled ? "Feature is currently LIVE for all users." : "Feature is currently DISABLED."}
        </p>
      </div>
      <button
        onClick={toggleFeature}
        disabled={isUpdating}
        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:opacity-50 ${
          isEnabled ? "bg-emerald-500" : "bg-neutral-600"
        }`}
      >
        <span
          className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
            isEnabled ? "translate-x-6" : "translate-x-1"
          }`}
        />
      </button>
    </div>
  );
}
