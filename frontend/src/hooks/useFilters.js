import { useEffect, useState } from "react";
import { getBrands, getPlatforms } from "../lib/api.js";

const ALL_PLATFORMS = [{ key: "all", label: "All platforms" }];

/** Brand and platform lists, loaded once and shared by every page. */
export function useFilters() {
  const [brands, setBrands] = useState([]);
  const [brand, setBrand] = useState(null);

  const [platforms, setPlatforms] = useState(ALL_PLATFORMS);
  const [platform, setPlatform] = useState("all");
  const [platformAvailable, setPlatformAvailable] = useState(null);

  const [error, setError] = useState(null);

  useEffect(() => {
    const ac = new AbortController();

    getBrands({ signal: ac.signal })
      .then((d) => {
        setBrands(d.brands);
        setBrand(d.default);
      })
      .catch((e) => {
        if (e.name === "AbortError") return;
        setError({ title: "Cannot reach the server", detail: e.message });
      });

    // Platform is optional; if the table has no platform column the dropdown
    // stays at 'all' and the rail explains why.
    getPlatforms({ signal: ac.signal })
      .then((d) => {
        setPlatforms(d.platforms);
        setPlatformAvailable(d.available);
      })
      .catch(() => {});

    return () => ac.abort();
  }, []);

  return {
    brands,
    brand,
    setBrand,
    platforms,
    platform,
    setPlatform,
    platformAvailable,
    error,
  };
}
