'use strict';

(() => {
  const CURL_MS = 700;
  const EYES_MS = 180;
  const STILL_MS = 1000;
  const RISE_MS = 850;
  const YAWN_MS = 1250;
  const clamp = value => Math.max(0, Math.min(1, value));
  function ease(value) {
    const t = clamp(value);
    return t * t * (3 - 2 * t);
  }

  function sleepingPose(elapsed) {
    const settled = elapsed >= CURL_MS;
    return {
      phase: settled ? 'sleeping' : 'settling',
      curl: ease(elapsed / CURL_MS),
      lid: ease(elapsed / (CURL_MS * .68)),
      showZ: settled,
    };
  }

  function wakingPose(elapsed, from) {
    if (elapsed < EYES_MS) {
      return {phase: 'opening', curl: from.curl, lid: from.lid * (1 - ease(elapsed / EYES_MS)), frozen: true};
    }
    elapsed -= EYES_MS;
    if (elapsed < STILL_MS) return {phase: 'holding', curl: from.curl, lid: 0, frozen: true};
    elapsed -= STILL_MS;
    if (elapsed < RISE_MS) {
      return {phase: 'rising', curl: from.curl * (1 - ease(elapsed / RISE_MS)), lid: 0};
    }
    elapsed -= RISE_MS;
    if (elapsed < YAWN_MS) {
      const progress = elapsed / YAWN_MS;
      const yawn = Math.sin(Math.PI * progress) ** 1.35;
      return {phase: 'yawning', curl: 0, lid: .72 * Math.sin(Math.PI * progress) ** .8, yawn};
    }
    return null;
  }

  function createSleepCycle(start, idleMs = 60_000, random = Math.random) {
    let lastActivity = start;
    let sleepAt = null;
    let waking = null;
    let posture, remaining = [];
    function begin(now) {
      if (!remaining.length) remaining = ['upright', 'loaf', 'pillow'];
      const choices = remaining.filter(style => style !== posture);
      posture = choices[Math.floor(random() * choices.length)];
      remaining.splice(remaining.indexOf(posture), 1);
      sleepAt = now;
      waking = null;
    }

    return {
      sample(now, canSleep = true) {
        if (waking) {
          const pose = wakingPose(now - waking.at, waking.pose);
          if (pose) return {...pose, posture};
          waking = null;
        }
        if (sleepAt === null && canSleep && now - lastActivity >= idleMs) begin(now);
        return sleepAt === null ? null : {...sleepingPose(now - sleepAt), posture};
      },
      activity(now) {
        lastActivity = now;
        if (sleepAt === null) return;
        waking = {at: now, pose: sleepingPose(now - sleepAt)};
        sleepAt = null;
      },
      startSleep(now) {
        begin(now);
      },
      setIdleMs(duration) {
        idleMs = duration;
      },
    };
  }

  if (typeof module === 'object' && module.exports) module.exports = {createSleepCycle};
  else window.createSleepCycle = createSleepCycle;
})();
