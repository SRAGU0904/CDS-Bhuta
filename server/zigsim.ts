export function extractYawDegrees(payload: unknown): number | null {
  if (!payload || typeof payload !== "object") return null;

  const source = payload as Record<string, unknown>;

  const getNumber = (value: unknown): number | null => {
    return typeof value === "number" && Number.isFinite(value) ? value : null;
  };

  const directYaw = getNumber(source.yaw);
  if (directYaw !== null) return directYaw;

  const attitudeYaw = (source.attitude as Record<string, unknown> | undefined)
    ?.yaw;
  const attitudeYawNumber = getNumber(attitudeYaw);
  if (attitudeYawNumber !== null) return attitudeYawNumber;

  const rotationY = (source.rotation as Record<string, unknown> | undefined)
    ?.y;
  const rotationYNumber = getNumber(rotationY);
  if (rotationYNumber !== null) return rotationYNumber;

  const dataYaw = (source.data as Record<string, unknown> | undefined)?.yaw;
  const dataYawNumber = getNumber(dataYaw);
  if (dataYawNumber !== null) return dataYawNumber;

  const sensorData = source.sensordata as Record<string, unknown> | undefined;
  if (sensorData) {
    const sensorYaw = getNumber(sensorData.yaw);
    if (sensorYaw !== null) return sensorYaw;

    const q = sensorData.quaternion as Record<string, unknown> | undefined;
    if (q) {
      const w = getNumber(q.w);
      const x = getNumber(q.x);
      const y = getNumber(q.y);
      const z = getNumber(q.z);

      if (w !== null && x !== null && y !== null && z !== null) {
        const yawRad = Math.atan2(
          2 * (w * z + x * y),
          1 - 2 * (y * y + z * z)
        );
        return (yawRad * 180) / Math.PI;
      }
    }

    const gravity = sensorData.gravity as Record<string, unknown> | undefined;
    if (gravity) {
      const gx = getNumber(gravity.x);
      const gz = getNumber(gravity.z);
      if (gx !== null && gz !== null) {
        const yawRad = Math.atan2(gx, -gz);
        return (yawRad * 180) / Math.PI;
      }
    }
  }

  return null;
}
