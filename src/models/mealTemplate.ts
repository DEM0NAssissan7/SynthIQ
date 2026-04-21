import { getBasalSensitivity } from "../lib/basal";
import {
  getSimilarSessionsDistances,
  type SessionAndScore,
} from "../lib/helpers/getSimilarSessionsDistances";
import { sessionsWeightedAverage } from "../lib/templateHelpers";
import { timeOfDayOffset } from "../lib/timing";
import { clamp, MathUtil } from "../lib/util";
import { InsulinVariantManager } from "../managers/insulinVariantManager";
import { BasalStore } from "../storage/basalStore";
import { CalibrationStore } from "../storage/calibrationStore";
import { PreferencesStore } from "../storage/preferencesStore";
import { PrivateStore } from "../storage/privateStore";
import Insulin from "./events/insulin";
import type Meal from "./events/meal";
import Session from "./session";
import Subscribable from "./subscribable";
import type { Template } from "./types/interfaces";
import type { Deserializer, Serializer } from "./types/types";

export default class MealTemplate extends Subscribable implements Template {
  sessions: Session[] = [];
  timestamp: Date;

  constructor(public name: string) {
    super();
    this.timestamp = new Date();
  }

  // Session management
  addSession(session: Session) {
    this.sessions.push(session);
    this.timestamp = session.timestamp; // We set the timestamp to be the latest added session timestamp
    this.addChildSubscribable(session);
  }
  get isFirstTime(): boolean {
    return this.sessions.length === 0;
  }
  get latestSession(): Session {
    if (this.sessions.length === 0)
      throw new Error(`There are no sessions in this template!`);
    let session: Session | null = null;
    for (let i = this.sessions.length - 1; i >= 0; i--) {
      const _session = this.sessions[i];
      if (session && _session.isInvalid) continue;
      session = _session;
      break;
    }
    if (!session)
      throw new Error(`Cannot retrieve latest session: unknown error`);
    return session;
  }
  get bestSession(): Session {
    if (this.sessions.length === 0)
      throw new Error(`There are no sessions in this template!`);
    const sessions = this.freshOrValidSessions;
    let session: Session | null = null;
    sessions.forEach((s) => {
      if (!session) {
        session = s;
        return;
      }
      if (s.score < session.score) {
        session = s;
      }
    });
    if (!session)
      throw new Error(`Cannot retrieve best session: unknown error`);
    return session;
  }
  get typicalSession(): Session {
    if (this.sessions.length === 0)
      throw new Error(`There are no sessions in this template!`);
    const validSessions = this.validSessions;
    let typicalCarbs = MathUtil.mode(validSessions.map((s) => s.carbs));
    let typicalProtein = MathUtil.mode(validSessions.map((s) => s.protein));
    let typicalNumFoods = MathUtil.mode(
      validSessions.map((s) => s.firstMeal.foods.length),
    );

    let typicalSessions: Session[] = [];
    let minDeviation = Infinity;
    this.freshOrValidSessions.forEach((s) => {
      // Ecludian distance
      const deviation =
        (s.carbs - typicalCarbs) ** 2 +
        (s.protein - typicalProtein) ** 2 +
        (typicalNumFoods - s.firstMeal.foods.length) ** 2;
      if (deviation < minDeviation) {
        typicalSessions = [];
        minDeviation = deviation;
      }
      if (deviation === minDeviation) {
        typicalSessions.push(s);
      }
    });
    if (typicalSessions.length === 0) throw new Error(`Unknown error.`);
    // Among the most typical, yeild the most well-controlled
    typicalSessions.sort((a, b) => a.score - b.score);
    return typicalSessions[0];
  }
  get recommendedSession(): Session {
    if (this.sessions.length === 0)
      throw new Error(`There are no sessions in this template!`);
    const sessions = this.validSessions.filter((s) => s.age < 5); // All sessions within the last 5 days
    if (!sessions.length) return this.typicalSession;
    let bestSession: Session | null = null;
    let minScore = Infinity;
    sessions.forEach((s) => {
      const score = s.score; // Cache score in a variable to prevent running the getter again
      if (score < minScore) {
        minScore = score;
        bestSession = s;
      }
    });
    if (!bestSession) throw new Error(`Unknown error.`);
    return bestSession;
  }

  // Nutrition Information
  get carbs(): number {
    if (this.isFirstTime) return 0;
    return this.latestSession.carbs;
  }
  get protein(): number {
    if (this.isFirstTime) return 0;
    return this.latestSession.protein;
  }
  get fat(): number {
    if (this.isFirstTime) return 0;
    return this.latestSession.fat;
  }

  // Control info
  get score(): number {
    return MathUtil.median(this.validSessions.map((s) => s.score));
  }
  get size(): number {
    return this.sessions.length;
  }
  get validSessions(): Session[] {
    const sessions = this.sessions.filter((s) => !s.isInvalid);
    return sessions;
  }
  get freshSessions(): Session[] {
    const sessions = this.validSessions.filter((s) => !s.expired);
    return sessions;
  }
  get expiredSessions(): Session[] {
    const sessions = this.validSessions.filter((s) => s.expired);
    return sessions;
  }
  get freshOrValidSessions(): Session[] {
    const freshSessions = this.freshSessions;
    if (freshSessions.length === 0) return this.validSessions;
    return freshSessions;
  }

  // Dosing info
  /** This gies you the meal dose insulin taken last, not accounting for correction */
  get previousInsulin(): number {
    if (this.isFirstTime) return 0;
    return this.latestSession.mealInsulin;
  }
  get insulinTiming(): number {
    if (this.isFirstTime) return 0;
    return (
      sessionsWeightedAverage(
        (s: Session) => s.getRelativeN(s.firstInsulinTimestamp),
        this.sessions,
      ) * 60
    );
  }

  // Meal Vectorization
  vectorizer(
    timestamp: Date,
    fastingVelocity: number,
    dailyBasal: number,
  ): Session[] | null {
    if (this.isFirstTime) return null;
    const validSessions = this.validSessions;
    if (validSessions.length === 0) return null; // Do not vectorize if we don't have any valid sessions

    let sessions = this.freshSessions;

    // K is the number of neighbors to select
    const K = Math.min(
      clamp(Math.floor(this.sessions.length / 3), 3, 9),
      this.sessions.length,
    ); // Adaptive number of desired sessions based on number of valid sessions

    // Discard expired sessions unless we don't have enough to fulfill K
    const expiredSessions = this.expiredSessions
      .slice()
      .sort((a, b) => a.age - b.age); // Sort by age to pull the newest ones first
    sessions = sessions.filter((s) => !s.expired); // Filter out expired sessions
    if (sessions.length < K) {
      // Salvage the latest expired sessions
      sessions.push(...expiredSessions.slice(0, K - sessions.length));
    }

    const getSafeScale = (absDistances: number[]) => {
      if (absDistances.length === 0) return 1e-6;
      const median = MathUtil.median(absDistances);
      if (median > 0) return median;
      const mean = MathUtil.mean(absDistances);
      if (mean > 0) return mean;
      const positives = absDistances.filter((x) => x > 0);
      return positives.length ? Math.min(...positives) : 1e-3;
    };

    // Query-centered per-axis scales = median/mean absolute differences (safe-guarded)
    const timeOfDayScale = getSafeScale(
      sessions.map((s) => Math.abs(timeOfDayOffset(timestamp, s.timestamp))),
    );
    const estimatedLiverOutput = BasalStore.estimatedLiverOutput.value ?? 0;
    const sensitivityIndex = getBasalSensitivity(
      estimatedLiverOutput,
      fastingVelocity,
      dailyBasal,
    ); // mg/dL per unit
    const sensitivityIndexScale = getSafeScale(
      sessions.map((s) =>
        Math.abs(
          sensitivityIndex - (s.getSensitivityIndex(estimatedLiverOutput) ?? 0),
        ),
      ),
    );

    // Get the closest X sessions
    let sessionDistances: SessionAndScore[] = [];
    for (let s of sessions) {
      if (!s.initialGlucose) continue;
      sessionDistances.push([
        s,
        (timeOfDayOffset(timestamp, s.timestamp) / timeOfDayScale) ** 2 + // Squared euclidean distance
          ((sensitivityIndex -
            (s.getSensitivityIndex(estimatedLiverOutput) ?? 0)) /
            sensitivityIndexScale) **
            2,
      ]);
    }
    sessionDistances.sort((a, b) => a[1] - b[1]);

    const nearSessions: Session[] = sessionDistances
      .slice(0, K)
      .map((a) => a[0]);
    if (nearSessions.length === 0) return null;

    // Eliminate outliers
    const kept: Session[] = [];
    const medianMealInsulin = MathUtil.median(
      nearSessions.map((s) => s.mealInsulin),
    );
    const mealInsulinMAD = getSafeScale(
      nearSessions.map((s) => Math.abs(s.mealInsulin - medianMealInsulin)),
    );

    const TAU = 1.5; // or 2.0 if you want looser
    const cutoff = TAU * mealInsulinMAD;
    for (let i = 0; i < nearSessions.length; i++) {
      const s = nearSessions[i];
      // Get rid of outliers
      if (Math.abs(s.mealInsulin - medianMealInsulin) <= cutoff) {
        kept.push(s);
        continue;
      }
    }

    let result = kept;
    if (result.length === 0) result = nearSessions;
    return result.sort((a, b) => a.age - b.age);
  }
  getClosestSession(
    timestamp: Date,
    fastingVelocity: number,
    dailyBasal: number,
  ): Session | null {
    const closestSessions = this.vectorizer(
      timestamp,
      fastingVelocity,
      dailyBasal,
    );
    if (!closestSessions) return null;
    return closestSessions[0];
  }
  getOptimalSession(
    timestamp: Date,
    fastingVelocity: number,
    dailyBasal: number,
  ): Session | null {
    const closestSessions = this.vectorizer(
      timestamp,
      fastingVelocity,
      dailyBasal,
    );
    if (!closestSessions) return null;
    // Choose the most typically controlled session (to avoid outliars)
    const medianScore = MathUtil.median(closestSessions.map((a) => a.score));
    return closestSessions.sort((a, b) => {
      const MADA = Math.abs(a.score - medianScore);
      const MADB = Math.abs(b.score - medianScore);
      return MADA - MADB;
    })[0];
  }
  getSimilarSessionsDistances(meal: Meal): SessionAndScore[] | null {
    if (this.isFirstTime) return null;

    const sessions = this.freshOrValidSessions.filter(
      (s) => s.meals.length === 1,
    );
    if (sessions.length === 0) return null;
    return getSimilarSessionsDistances(meal, sessions);
  }
  getBaseSession(meal: Meal): Session | null {
    let sessionsDistances = this.getSimilarSessionsDistances(meal);
    if (!sessionsDistances) return null;
    if (sessionsDistances.length === 0) return null;
    if (sessionsDistances.length === 1) return sessionsDistances[0][0];

    const distances = sessionsDistances.map((x) => x[1]);
    const q1 = MathUtil.Q1(distances);
    const iqr = MathUtil.IQR(distances);

    // Tighter = q1 + 1.0 * iqr
    // Looser = q1 + 1.5 * iqr
    const cutoff = q1 + 1.0 * iqr;

    const groupedSessions = sessionsDistances
      .filter(([, d]) => d <= cutoff)
      .map(([s]) => s);

    if (groupedSessions.length === 0) {
      return sessionsDistances[0]![0];
    }

    // Cluster together sessions with similar dosing strategies
    let structuredSessions: Session[][] = [];
    // First pass: We group together sessions that have the same variants and # of shots
    function sameStructure(a: Session, b: Session): boolean {
      if (a.insulins.length !== b.insulins.length) return false;

      for (let i = 0; i < a.insulins.length; i++) {
        const i1 = a.insulins[i];
        const i2 = b.insulins[i];
        if (!i1 || !i2) return false;
        if (i1.variant.name !== i2.variant.name) return false;
      }

      return true;
    }
    for (const session of groupedSessions) {
      // Go through all sessions
      let isNew = true;
      for (const cluster of structuredSessions) {
        let identical = true; // Tracks if we are identical to this cluster
        const s = cluster[0]; // We choose the first element of the cluster because they would all be the same
        if (!s) {
          identical = false;
        } else {
          identical = sameStructure(s, session);
        }
        if (identical) {
          cluster.push(session);
          isNew = false;
          break;
        }
      }
      if (isNew) {
        structuredSessions.push([session]);
      }
    }

    /**
     * Second pass: now that we have the identically structured sessions, we can cluster numerically
     */
    function findDistance(a: number[], b: number[], scales: number[]) {
      let distance = 0;
      if (a.length !== b.length || b.length !== scales.length)
        throw new Error(
          `Cannot find distance between differently sized vectors`,
        );
      for (let i = 0; i < a.length; i++) {
        distance += Math.abs(a[i] - b[i]) / scales[i];
      }
      return distance;
    }
    type Dose = {
      dose: number;
      time: number;
      effectRatio: number;
    };
    type Strategy = Dose[];
    function flattenStrategy(strategy: Strategy): number[] {
      const vector: number[] = [];
      for (const d of strategy) {
        vector.push(d.dose);
        vector.push(d.time);
        vector.push(d.effectRatio);
      }
      return vector;
    }
    function computeThresholdFromDistances(distances: number[]): number {
      if (distances.length === 0) return Infinity;
      if (distances.length === 1) return distances[0];

      const q1 = MathUtil.Q1(distances);
      const iqr = MathUtil.IQR(distances);

      return q1 + 1.0 * iqr;
    }
    function averageVectors(vectors: number[][]): number[] {
      const length = vectors[0].length;
      const avg = new Array(length).fill(0);

      for (const v of vectors) {
        for (let i = 0; i < length; i++) {
          avg[i] += v[i];
        }
      }

      for (let i = 0; i < length; i++) {
        avg[i] /= vectors.length;
      }

      return avg;
    }
    type Cluster = {
      sessions: Session[];
      score: number;
      vectors: number[][];
      centroid: number[];
      scales: number[];
    };
    function clusterStrategies(
      sessions: Session[],
      strategies: Strategy[],
      threshold: number,
      scales: number[],
    ): Cluster[] {
      const vectors = strategies.map(flattenStrategy);

      const clusters: Cluster[] = [];

      for (let i = 0; i < sessions.length; i++) {
        const session = sessions[i];
        const vector = vectors[i];

        let bestCluster: Cluster | null = null;
        let bestDistance = Infinity;

        // Find closest cluster
        for (const cluster of clusters) {
          const dist = findDistance(vector, cluster.centroid, scales);

          if (dist < bestDistance) {
            bestDistance = dist;
            bestCluster = cluster;
          }
        }

        // Decide: join or create new
        if (bestCluster && bestDistance <= threshold) {
          bestCluster.sessions.push(session);
          bestCluster.vectors.push(vector);
          bestCluster.centroid = averageVectors(bestCluster.vectors);
        } else {
          clusters.push({
            sessions: [session],
            vectors: [vector],
            centroid: vector.slice(),
            score: NaN,
            scales: scales,
          });
        }
      }

      return clusters;
    }
    let clusters: Cluster[] = [];
    structuredSessions.forEach((sessions) => {
      // Compile all strategies into a set of vectors
      let numInsulins = 0;
      const strategies: Strategy[] = sessions.map((s): Strategy => {
        const totalInsulinEffect = s.insulinEffect;
        let doses: Dose[] = [];
        s.insulins.forEach((insulin) => {
          const dose: Dose = {
            dose: insulin.value,
            time: s.getN(insulin.timestamp),
            effectRatio:
              totalInsulinEffect > 0
                ? (insulin.value * insulin.variant.effect) / totalInsulinEffect
                : 0,
          };
          doses.push(dose);
        });
        numInsulins = s.insulins.length;
        return doses;
      });

      // Now we build the scales vector
      let scales: number[] = [];
      const vectors = strategies.map(flattenStrategy);
      for (let i = 0; i < numInsulins * 3; i++) {
        let nums: number[] = vectors.map((s) => s[i]);
        const epsilon = 1e-6;
        const scale = MathUtil.IQR(nums);
        scales.push(scale !== 0 ? scale : epsilon);
      }

      // Find the distributions of each thing relative to another
      const distances: number[] = [];
      for (let i = 0; i < vectors.length; i++) {
        for (let j = i + 1; j < vectors.length; j++) {
          distances.push(findDistance(vectors[i], vectors[j], scales));
        }
      }

      // Compute threshold from distribution
      const threshold = computeThresholdFromDistances(distances);

      // Now cluster using that threshold
      const subclusters = clusterStrategies(
        sessions,
        strategies,
        threshold,
        scales,
      );
      clusters.push(...subclusters);
    });

    // Filter out clusters that have only one session unless that's all we got
    if (PrivateStore.debugLogs.value) console.log(clusters);
    const filteredClusters = clusters.filter((c) => c.sessions.length > 1);
    if (filteredClusters.length > 1) clusters = filteredClusters; // We need to have multiple because in the case we only have 1, we probably don't have enough data

    // Now that we finally have our clusters, we look at the best scoring cluster of sessions
    clusters.forEach((cluster) => {
      // First calculate the score
      cluster.score = MathUtil.median(cluster.sessions.map((s) => s.score));
    });
    // Now find the lowest (best) scoring cluster
    if (clusters.length === 0) return null;
    const bestCluster = clusters.sort((a, b) => a.score - b.score)[0];
    if (!bestCluster) return null;

    // Then we find the session within that cluster that has the most accurate dosing strategy
    function findMostSimilarSession(cluster: Cluster) {
      return getSimilarSessionsDistances(meal, cluster.sessions)[0][0];
    }
    return findMostSimilarSession(bestCluster);
  }

  // Dosing helpers
  vectorizeInsulin(meal: Meal, session: Session | null): Insulin[] {
    // If session is null
    if (!session) {
      const defaultVariant = InsulinVariantManager.getDefault();
      const profileInsulin = this.getProfileInsulin(
        meal.carbs,
        meal.protein,
        defaultVariant,
      );
      return [new Insulin(profileInsulin, new Date(), defaultVariant)];
    }
    // Otherwise, magic
    let insulins = session.optimalMealInsulins.map(
      (i) => new Insulin(i.value, i.timestamp, i.variant),
    );
    const offsets = this.getInsulinOffsets(session, meal);
    for (let i = 0; i < insulins.length; i++) {
      insulins[i].value += offsets[i].value;
    }
    return insulins;
  }
  getProfileInsulin(
    carbs: number,
    protein: number,
    variant = InsulinVariantManager.getDefault(),
  ) {
    const carbsRise = carbs * CalibrationStore.carbsEffect.value;
    const proteinRise = protein * CalibrationStore.proteinEffect.value;
    return (carbsRise + proteinRise) / variant.effect;
  }
  getInsulinOffsets(session: Session, meal: Meal) {
    const carbsEffect = CalibrationStore.carbsEffect.value;
    const proteinEffect = CalibrationStore.proteinEffect.value;

    const sessionMeal = session.metaMeal;
    const profileRise =
      sessionMeal.carbs * carbsEffect + sessionMeal.protein * proteinEffect;

    const optimalMealInsulins = session.optimalMealInsulins;
    const optimalMealInsulinsEffect = optimalMealInsulins.reduce(
      (n, i) => n + i.value * i.variant.effect,
      0,
    ); // We get the perceived effect of the insulins only because we are going to be applying to heterogenous effects between shots
    const profileScale =
      profileRise > 0 ? optimalMealInsulinsEffect / profileRise : 1; // Slope for profile

    const insulins = optimalMealInsulins.map(
      (i) => new Insulin(0, i.timestamp, i.variant),
    );
    if (insulins.length === 0) return []; // Safety
    const carbsRise =
      (meal.carbs - sessionMeal.carbs) * carbsEffect * profileScale;
    insulins[0].value += carbsRise / insulins[0].variant.effect; // Add extra carbs offset to first shot, as they typically only act on first shot timeframe

    const proteinRisePerShot =
      ((meal.protein - sessionMeal.protein) / insulins.length) *
      proteinEffect *
      profileScale;
    insulins.forEach((i) => (i.value += proteinRisePerShot / i.variant.effect)); // Distribute protein between all shots
    return insulins;
  }
  getMealInsulinOffset(session: Session, meal: Meal) {
    let insulin = 0;
    const offsets = this.getInsulinOffsets(session, meal);
    offsets.forEach((offset) => (insulin += offset.value));
    return insulin;
  }

  // Serialization
  static serialize: Serializer<MealTemplate> = (template: MealTemplate) => {
    const sessions = template.sessions.filter(
      (s) => s.age < PreferencesStore.maxSessionLife.value,
    ); // Get rid of old sessions upon serialization
    return {
      name: template.name,
      sessions: sessions.map((s) => Session.serialize(s)),
      timestamp: template.timestamp.getTime(),
    };
  };
  static deserialize: Deserializer<MealTemplate> = (o) => {
    let template = new MealTemplate(o.name);
    o.sessions.forEach((s: string) =>
      template.addSession(Session.deserialize(s)),
    );
    template.timestamp = new Date(o.timestamp);
    return template;
  };
}
