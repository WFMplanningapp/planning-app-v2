import assert from "node:assert/strict"
import {
  copyFile,
  mkdir,
  rm,
} from "node:fs/promises"
import path from "node:path"
import {
  pathToFileURL,
} from "node:url"

const projectRoot = process.cwd()

const sourcePath = path.join(
  projectRoot,
  "lib",
  "capacity",
  "canonicalCapacityModel.js"
)

const temporaryDirectory = path.join(
  projectRoot,
  ".tmp-tests"
)

const temporaryModulePath = path.join(
  temporaryDirectory,
  "canonicalCapacityModel.mjs"
)

let passed = 0
let failed = 0

const test = async (name, callback) => {
  try {
    await callback()
    passed += 1
    console.log(`PASS ${name}`)
  } catch (error) {
    failed += 1
    console.error(`FAIL ${name}`)
    console.error(error)
  }
}

const createBaseWeek = (overrides = {}) => ({
  periodType: "future",
  availabilitySource: "planned",
  firstDate: "2026-09-07",
  totalHC: 10,
  trainees: 0,
  nesting: 0,
  inLOA: 0,

  totalFTE: 10,
  expectedFTE: 8,
  PlanProdFTE: 6,

  actualFTE: 7,
  ActProdFTE: 5,

  compositeGrossFTE: 10,
  compositeInCenterFTE: 8,
  compositeProductiveFTE: 6,

  grossRequirement: 9,
  inCenterRequirement: 7,
  productiveRequirement: 4,

  requirementSources: {
    gross: "manual",
    inCenter: "manual",
    productive: "manual",
  },

  manualGrossReq: 9,
  manualInCenterReq: 7,
  manualProductiveReq: 4,

  engineOverride: true,

  hasShrinkage: false,
  hasPlanned: false,
  hasActual: false,

  week: {
    code: "2026w37",
    firstDate: "2026-09-07T00:00:00Z",
    lastDate: {
      $date: "2026-09-13T00:00:00Z",
    },
  },

  ...overrides,
})

await mkdir(
  temporaryDirectory,
  { recursive: true }
)

await copyFile(
  sourcePath,
  temporaryModulePath
)

try {
  const {
    CAPACITY_SCHEMA_VERSION,
    toCanonicalCapacity,
    toCanonicalCapacityWeek,
  } = await import(
    `${pathToFileURL(
      temporaryModulePath
    ).href}?version=${Date.now()}`
  )

  await test(
    "exports schema version 2",
    () => {
      assert.equal(
        CAPACITY_SCHEMA_VERSION,
        2
      )
    }
  )

  await test(
    "maps plan identity and period dates",
    () => {
      const result =
        toCanonicalCapacityWeek(
          createBaseWeek(),
          {
            capacityPlanId: "plan-123",
            capacityPlanName:
              "Example plan",
          }
        )

      assert.equal(
        result.identity.capacityPlanId,
        "plan-123"
      )
      assert.equal(
        result.identity.capacityPlanName,
        "Example plan"
      )
      assert.equal(
        result.period.code,
        "2026w37"
      )
      assert.equal(
        result.period.startDate,
        "2026-09-07"
      )
      assert.equal(
        result.period.endDate,
        "2026-09-13"
      )
    }
  )

  await test(
    "preserves numeric zero and maps missing values to null",
    () => {
      const result =
        toCanonicalCapacityWeek(
          createBaseWeek({
            grossRequirement: 0,
            manualGrossReq: 0,
            engineGrossReq: "",
            budgetFTE: "",
          })
        )

      assert.equal(
        result.requirements.gross.value,
        0
      )
      assert.equal(
        result.requirements.gross.manual,
        0
      )
      assert.equal(
        result.requirements.gross.engine,
        null
      )
      assert.equal(
        result.forecast.fte,
        null
      )
      assert.equal(
        result.dataQuality
          .preservedZeroValues,
        true
      )
    }
  )

  await test(
    "calculates all three gaps",
    () => {
      const result =
        toCanonicalCapacityWeek(
          createBaseWeek()
        )

      assert.equal(
        result.gaps.gross,
        1
      )
      assert.equal(
        result.gaps.inCenter,
        1
      )
      assert.equal(
        result.gaps.productive,
        2
      )
    }
  )

  await test(
    "preserves manual requirement provenance",
    () => {
      const result =
        toCanonicalCapacityWeek(
          createBaseWeek()
        )

      assert.equal(
        result.requirements.gross.source,
        "manual"
      )
      assert.equal(
        result.requirements.inCenter.source,
        "manual"
      )
      assert.equal(
        result.requirements
          .productive.source,
        "manual"
      )

      assert.equal(
        result.requirements.gross.manual,
        9
      )
      assert.equal(
        result.requirements.gross.engine,
        null
      )
      assert.equal(
        result.requirements.gross
          .isOverride,
        true
      )
    }
  )

  await test(
    "preserves engine values and metadata",
    () => {
      const result =
        toCanonicalCapacityWeek(
          createBaseWeek({
            grossRequirement: 52.5,
            inCenterRequirement: 44.8875,
            productiveRequirement:
              39.590775,

            requirementSources: {
              gross: "engine",
              inCenter: "engine",
              productive: "engine",
            },

            manualGrossReq: null,
            manualInCenterReq: null,
            manualProductiveReq: null,

            engineGrossReq: 52.5,
            engineInCenterReq: 44.8875,
            engineProductiveReq:
              39.590775,

            engineSource:
              "capacityEngineV4",
            engineCalculatedAt:
              "2026-09-04T12:02:33.561Z",
            engineReqVar: -34.8875,
            engineBillVar: -29.590775,
            engineHoursGross: 2100,
            engineHoursInCenter: 1795.5,
            engineHoursProductive:
              1583.631,
            engineOverride: false,
          })
        )

      assert.equal(
        result.requirements.gross.source,
        "engine"
      )
      assert.equal(
        result.requirements.gross.engine,
        52.5
      )
      assert.equal(
        result.engine.source,
        "capacityEngineV4"
      )
      assert.equal(
        result.engine.calculatedAt,
        "2026-09-04"
      )
      assert.equal(
        result.engine.hours.gross,
        2100
      )
      assert.equal(
        result.gaps.gross,
        -42.5
      )
    }
  )

  await test(
    "preserves carried requirement provenance",
    () => {
      const result =
        toCanonicalCapacityWeek(
          createBaseWeek({
            grossRequirement: 0,
            inCenterRequirement: 0,
            productiveRequirement: 0,

            requirementSources: {
              gross: "manual-carried",
              inCenter: "manual-carried",
              productive:
                "manual-carried",
            },

            manualGrossReq: null,
            manualInCenterReq: null,
            manualProductiveReq: null,
            engineOverride: false,
          })
        )

      assert.equal(
        result.requirements.gross.source,
        "manual-carried"
      )
      assert.equal(
        result.requirements.inCenter.source,
        "manual-carried"
      )
      assert.equal(
        result.requirements
          .productive.source,
        "manual-carried"
      )
    }
  )

  await test(
    "maps completed weeks to actual availability",
    () => {
      const result =
        toCanonicalCapacityWeek(
          createBaseWeek({
            periodType: "completed",
            availabilitySource: "actual",
            compositeGrossFTE: 7,
            compositeInCenterFTE: 7,
            compositeProductiveFTE: 5,
          })
        )

      assert.equal(
        result.period.type,
        "completed"
      )
      assert.equal(
        result.period.availabilitySource,
        "actual"
      )
      assert.equal(
        result.availability.gross.value,
        7
      )
      assert.equal(
        result.availability.inCenter.actual,
        7
      )
      assert.equal(
        result.availability
          .productive.actual,
        5
      )
    }
  )

  await test(
    "derives end date for flattened multiple-plan rows",
    () => {
      const result =
        toCanonicalCapacityWeek(
          createBaseWeek({
            firstDate: "2026-06-29",
            week: "2026w27",
          })
        );

      assert.equal(
        result.period.code,
        "2026w27"
      );

      assert.equal(
        result.period.startDate,
        "2026-06-29"
      );

      assert.equal(
        result.period.endDate,
        "2026-07-05"
      );

      assert.equal(
        result.dataQuality
          .hasLegacyWeekObject,
        false
      );
    }
  );

  await test(
    "maps an array without changing row count",
    () => {
      const result =
        toCanonicalCapacity(
          [
            createBaseWeek(),
            createBaseWeek({
              firstDate: "2026-09-14",
              week: {
                code: "2026w38",
                firstDate:
                  "2026-09-14T00:00:00Z",
                lastDate: {
                  $date:
                    "2026-09-20T00:00:00Z",
                },
              },
            }),
          ],
          {
            capacityPlanId: "plan-123",
            capacityPlanName:
              "Example plan",
          }
        )

      assert.equal(
        result.length,
        2
      )
      assert.equal(
        result[1].period.code,
        "2026w38"
      )
    }
  )
} finally {
  await rm(
    temporaryDirectory,
    {
      recursive: true,
      force: true,
    }
  )
}

console.log(
  `\n${passed} passed, ${failed} failed`
)

if (failed > 0) {
  process.exitCode = 1
}
