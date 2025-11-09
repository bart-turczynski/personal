const truncate = (value = "", limit = 4096) => {
  if (typeof value !== "string") {
    return String(value);
  }
  return value.length > limit ? `${value.slice(0, limit)}…` : value;
};

const normaliseFieldEntries = (formData) => {
  const fields = {};

  for (const [key, rawValue] of formData.entries()) {
    let value = rawValue;
    if (typeof rawValue === "object" && rawValue !== null && "name" in rawValue) {
      const fileMeta = {
        name: rawValue.name,
        type: rawValue.type,
        size: rawValue.size,
      };
      value = `[file:${JSON.stringify(fileMeta)}]`;
    }

    if (fields[key]) {
      if (Array.isArray(fields[key])) {
        fields[key].push(truncate(value));
      } else {
        fields[key] = [fields[key], truncate(value)];
      }
    } else {
      fields[key] = truncate(value);
    }
  }

  return fields;
};

const calculateScore = ({ honeyTripped, cfThreatScore, notes = "" }) => {
  let score = 10;
  if (honeyTripped) score += 60;
  if (cfThreatScore) score += Math.min(cfThreatScore, 20);
  if (notes && notes.length > 280) score += 10;
  if (notes && /http(s)?:\/\//i.test(notes)) score += 10;
  return Math.min(score, 100);
};

export const onRequest = async ({ request }) => {
  if (request.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed", allowed: ["POST"] }),
      {
        status: 405,
        headers: {
          "content-type": "application/json",
          Allow: "POST",
          "cache-control": "no-store",
        },
      }
    );
  }

  let formData;
  try {
    formData = await request.formData();
  } catch (error) {
    console.error("honeypot: invalid form payload", error);
    return new Response(JSON.stringify({ status: "error", message: "Invalid form payload" }), {
      status: 400,
      headers: { "content-type": "application/json", "cache-control": "no-store" },
    });
  }

  const fields = normaliseFieldEntries(formData);
  const honeyTokenRaw = formData.get("honey_token");
  const honeyTripped = Boolean(honeyTokenRaw && honeyTokenRaw.toString().trim().length);
  const cf = request.cf || {};

  const metadata = {
    event: "web-honeypot",
    timestamp: new Date().toISOString(),
    path: new URL(request.url).pathname,
    formId: formData.get("form_id") || null,
    honeyTripped,
    cfRay: request.headers.get("cf-ray") || null,
    ip: request.headers.get("cf-connecting-ip") || null,
    country: cf.country || null,
    colo: cf.colo || null,
    asn: cf.asn || null,
    userAgent: request.headers.get("user-agent") || null,
    referer: request.headers.get("referer") || null,
    threatScore: cf.threatScore || null,
    fields,
  };

  const noteSource = fields.notes || fields.summary || "";
  const normalisedNotes = Array.isArray(noteSource) ? noteSource.join(" ") : noteSource;

  const score = calculateScore({
    honeyTripped,
    cfThreatScore: cf.threatScore,
    notes: normalisedNotes,
  });

  const classification = honeyTripped ? "honeypot" : score >= 60 ? "suspicious" : "observed";

  console.log(
    JSON.stringify({
      ...metadata,
      score,
      classification,
    })
  );

  return new Response(
    JSON.stringify({
      status: "received",
      classification,
      score,
      reference: metadata.cfRay,
    }),
    {
      status: 202,
      headers: {
        "content-type": "application/json",
        "cache-control": "no-store",
      },
    }
  );
};
