import type Session from "../models/session";
import MetabolismProfile from "../models/metabolism/metabolismProfile";
import { profile as userProfile } from "../storage/metaProfileStore";
import { nelderMead, type FMinResult } from "fmin";
import { round } from "./util";

type ProfileArray = [
  effectInsulin: number,
  peakInsulin: number,

  effectCarbs: number,
  peakCarbs: number,

  effectProtein: number,
  delayProtein: number,
  minTimeProtein: number,
  plateuRateProtein: number
];

function modifyProfileFromArray(
  array: ProfileArray,
  profile: MetabolismProfile
): void {
  const f = (a: number) => round(Math.max(a, 0), 2);
  profile.insulin.effect = f(array[0]);
  profile.insulin.halfLife = f(array[1]);

  profile.carbs.effect = f(array[2]);
  profile.carbs.peak = f(array[3]);

  profile.protein.effect = f(array[4]);
  profile.protein.delay = f(array[5]);
  profile.protein.minTime = f(array[6]);
  profile.protein.plateuRate = f(array[7]);
}

function createProfileFromArray(array: ProfileArray): MetabolismProfile {
  let profile = MetabolismProfile.parse(
    MetabolismProfile.stringify(userProfile)
  );
  modifyProfileFromArray(array, profile);
  return profile;
}

function createArrayFromProfile(profile: MetabolismProfile): ProfileArray {
  return [
    profile.insulin.effect,
    profile.insulin.halfLife,

    profile.carbs.effect,
    profile.carbs.peak,

    profile.protein.effect,
    profile.protein.delay,
    profile.protein.minTime,
    profile.protein.plateuRate,
  ];
}

function cost(
  session: Session,
  params: ProfileArray,
  t: number[],
  observed: number[]
): number {
  const profile = createProfileFromArray(params);
  const predicted = t.map((t) => session.deltaBG(t, profile));
  let retval = 0;
  for (let i = 0; i < observed.length; i++) {
    const real = observed[i];
    const sim = predicted[i];
    retval += Math.pow(sim - real, 2);
  }
  return retval;
}

export function optimize(
  costFunction: (params: number[]) => number,
  targetProfile: MetabolismProfile
) {
  let initial: ProfileArray = createArrayFromProfile(userProfile);
  const result: FMinResult = nelderMead(costFunction, initial);
  const optimizedProfileArray = result.x as ProfileArray;
  modifyProfileFromArray(optimizedProfileArray, targetProfile);
  console.log(result);
}

export function optimizeSession(
  session: Session,
  targetProfile: MetabolismProfile
) {
  const t = session.tValues;
  return session.getObservedReadings().then((a) => {
    const observed: number[] = a.map((b: any) => b.sgv);
    const costFunction = (params: number[]) =>
      cost(session, params as ProfileArray, t, observed);
    optimize(costFunction, targetProfile);
  });
}

// Multi-session optimization

class SessionInfoCache {
  session: Session;
  t: number[];
  observed: number[] = [];
  constructor(session: Session, observed: number[]) {
    this.session = session;
    this.t = session.tValues;
    this.observed = observed;
  }
}

export function optimizeSessions(
  sessions: Session[],
  targetProfile: MetabolismProfile,
  postHandler?: () => void
) {
  let sessionInfos: SessionInfoCache[] = [];

  const costFunction = (_params: number[]) => {
    let totalCost = 0;
    const params = _params as ProfileArray;
    // Find max difference
    sessionInfos.forEach((info) => {
      const session = info.session;
      const t = info.t;
      const observed = info.observed;
      const c = cost(session, params, t, observed);
      totalCost += c;
    });
    return totalCost;
  };

  const checkCompletion = () => {
    if (sessionInfos.length === sessions.length) {
      console.log(sessionInfos);
      optimize(costFunction, targetProfile);
      if (postHandler) postHandler();
    }
  };

  sessions.forEach((session) => {
    session.getObservedReadings().then((a) => {
      const observed = a.map((b: any) => b.sgv);
      const info = new SessionInfoCache(session, observed);
      sessionInfos.push(info);
      checkCompletion();
    });
  });
}
