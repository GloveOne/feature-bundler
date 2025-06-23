import gql from "graphql-tag.macro";

export const pageInfoFragment = gql`
  fragment PageInfoFragment on PagedPageInfo {
    page
    totalPages
    hasNextPage
  }
`;

const campaignFragment = gql`
  fragment CampaignFragment on Campaign {
    id
    name
    date
    totalAmount
    institution {
      companyName
    }
    clinic {
      name
      logo {
        url
      }
    }
  }
`;

const campaignShotFragment = gql`
  fragment CampaignShotFragment on CampaignShot {
    id
    patient {
      name
      gender
      birthDate
    }
    vaccine {
      name
    }
    shotSite
    applicationDate
    applied
    value
  }
`;

const campaignShareFragment = gql`
  fragment CampaignShareFragment on CampaignShare {
    id
    code
    campaign {
      ...CampaignFragment
    }
  }
  ${campaignFragment}
`;

const priceFragment = gql`
  fragment PriceFragment on Price {
    __typename
    type: __typename
    price
    ... on HealthInsurancePrice {
      healthInsurance {
        name
        discount
      }
    }
  }
`;

const feeFragment = gql`
  fragment FeeFragment on Fee {
    fee {
      ... on FixedAmount {
        amount
      }
      ... on PercentAmount {
        percentage
      }
    }
  }
`;

const discountFragment = gql`
  fragment DiscountFragment on Discount {
    discount {
      ... on FixedAmount {
        amount
      }
      ... on PercentAmount {
        percentage
      }
    }
  }
`;

const validationErrorsFragment = gql`
  fragment ValidationErrorsFragment on ValidationErrors {
    errors {
      __typename
      type: __typename
      error
      ... on FieldValidationError {
        field
      }
    }
  }
`;

const orderFragment = gql`
  fragment OrderFragment on Order {
    __typename
    type: __typename
    id
    date
    total
    vaccineBundle {
      name
    }
    fees {
      ...FeeFragment
    }
    discounts {
      ...DiscountFragment
    }
    payments {
      __typename
      type: __typename
      id
      amount
      installments
      method {
        id
        label
        maxInstallments
      }
    }
    items {
      __typename
      type: __typename
      id
      price
      fees {
        ...FeeFragment
      }
      discounts {
        ...DiscountFragment
      }
      total
      invoiceItemDescription
      ... on VaccineOrderItem {
        shot {
          id
          date
          vaccine {
            id
            name
          }
          manufacturer {
            id
            name
          }
          patient {
            id
            name
            birthDate
          }
        }
      }
    }
    ... on PaidOrder {
      invoiceRecipientSuggestions {
        name
        email
        cpf
        phoneNumber
        address
        number
        complement
        district
        city
        cityCode
        state
        zipCode
        ... on PatientInvoiceRecipientSuggestion {
          patient {
            id
            recipientId: id
          }
        }
      }
    }
  }
  ${feeFragment}
  ${discountFragment}
`;

const batchFragment = gql`
  fragment BatchFragment on VaccineBatch {
    __typename
    type: __typename
    id
    label
    expirationDate
    inventoryCount(inventoryDate: $inventoryDate) @include(if: $withInventoryCount)
    manufacturer {
      __typename
      type: __typename
      id
      name
      barcode
      availableCount: inventoryCount(inventoryDate: $inventoryDate)
        @include(if: $withInventoryCount)
      inventoryCount(inventoryDate: $inventoryDate, onlyAvailable: false)
        @include(if: $withInventoryCount)
    }
  }
`;

const doseFragment = gql`
  fragment DoseFragment on Dose {
    __typename
    type: __typename
    id
    label
  }
`;

const vaccineFragment = gql`
  fragment VaccineFragment on Vaccine {
    __typename
    type: __typename
    id
    name
    price(clinicId: $clinicId) @include(if: $withPrice)
    prices(patientId: $patientId, clinicId: $clinicId) @include(if: $withPrices) {
      ...PriceFragment
    }
    inventoryCount(inventoryDate: $inventoryDate, clinicId: $clinicId, onlyAvailable: false)
      @include(if: $withInventoryCount)
    availableCount: inventoryCount(inventoryDate: $inventoryDate, clinicId: $clinicId)
      @include(if: $withInventoryCount)
    discounts(patientId: $patientId) @include(if: $withDiscounts) {
      ...DiscountFragment
    }
    fees(patientId: $patientId) @include(if: $withFees) {
      ...FeeFragment
    }
    doses(patientId: $patientId) @include(if: $withDoses) {
      ...DoseFragment
      shot {
        type: __typename
        id
        date
      }
    }
    applicationSites(clinicId: $clinicId) @include(if: $withApplicationSites) {
      id
      label
    }
    applicationMethods @include(if: $withApplicationMethods) {
      id
      label
    }
    manufacturers @include(if: $withManufacturers) {
      __typename
      type: __typename
      id
      name
      barcode
      inventoryCount(inventoryDate: $inventoryDate, clinicId: $clinicId, onlyAvailable: false)
        @include(if: $withInventoryCount)
      availableCount: inventoryCount(inventoryDate: $inventoryDate, clinicId: $clinicId)
        @include(if: $withInventoryCount)
      batches(
        inventoryDate: $inventoryDate
        withoutInventory: $withoutInventoryBatches
        withoutInventoryCount: $withoutInventoryCountBatches
        clinicId: $clinicId
      ) @include(if: $withBatches) {
        ...BatchFragment
      }
      reservable(inventoryDate: $inventoryDate, clinicId: $clinicId) @include(if: $withReservable)
    }
    batches(
      inventoryDate: $inventoryDate
      withoutInventory: $withoutInventoryBatches
      withoutInventoryCount: $withoutInventoryCountBatches
      clinicId: $clinicId
    ) @include(if: $withBatches) {
      ...BatchFragment
    }
    suggestedDose(patientId: $patientId, clinicId: $clinicId) @include(if: $withSuggestions) {
      ...DoseFragment
    }
    suggestedApplicationSite(clinicId: $clinicId) @include(if: $withSuggestions) {
      id
      label
    }
    reservable(inventoryDate: $inventoryDate, clinicId: $clinicId) @include(if: $withReservable)
    sipniSynchronizable
    ongoingCampaign
  }
  ${batchFragment}
  ${priceFragment}
  ${discountFragment}
  ${feeFragment}
  ${doseFragment}
`;

const applierFragment = gql`
  fragment ApplierFragment on Applier {
    __typename
    type: __typename
    id
    name
    coren
  }
`;

const shotFragment = gql`
  fragment ShotFragment on VaccineShot {
    __typename
    type: __typename
    id
    date
    patient @include(if: $withPatient) {
      id
      name
    }
    vaccine @include(if: $withVaccine) {
      id
      name
      inventoryCount
    }
    batch @include(if: $withBatch)
    dose @include(if: $withDose) {
      id
      label
    }
    observations
    ... on InternalVaccineShot {
      manufacturer @include(if: $withManufacturer) {
        id
        name
      }
      homeService
      appointmentResponsibleApplier @include(if: $withAppointmentApplier) {
        id
        name
      }
    }
    ... on ScheduledShot {
      orderItem {
        id
      }
      order {
        id
      }
      reserved
      fullPriceWithPreviousShots
    }
    ... on PendingShot {
      reserved
      fullPriceWithPreviousShots
    }
    ... on Payable {
      paid: isPaymentStatus(status: PAID)
      paying: isPaymentStatus(status: PAYING)
      payable
      chargedPrice
    }
  }
`;

const invoiceItemFragment = gql`
  fragment InvoiceItemFragment on InvoiceItem {
    ... on VaccineOrderItemInvoiceItem {
      orderItem {
        id
      }
    }
    ... on CampaignInvoiceItem {
      campaign {
        id
      }
    }
    ... on CampaignShotInvoiceItem {
      campaignShot {
        id
      }
    }
  }
`;

const appointmentFragment = gql`
  fragment AppointmentFragment on Appointment {
    __typename
    type: __typename
    id
    labels
    label
    date
    createdAt
    service
    time
    applier {
      id
      name
    }
    source
    editable
    clinic {
      id
      name
    }
    patients {
      id
      name
    }
  }
`;

const externalAppointmentFragment = gql`
  fragment ExternalAppointmentFragment on ExternalAppointment {
    client {
      name
      cpf
      email
      phoneNumber
    }
    address {
      street
      number
      complement
      district
      city
      state
      zipCode
    }
    fees {
      ...FeeFragment
    }
    discounts {
      ...DiscountFragment
    }
    products {
      __typename
      type: __typename
      id
      bundleName
      ... on Payable {
        orderItem {
          __typename
          type: __typename
          id
          price
          fees {
            ...FeeFragment
          }
          discounts {
            ...DiscountFragment
          }
          total
        }
        chargedPrice
        refundable
        processing: isPaymentStatus(status: PROCESSING)
        paid: isPaymentStatus(status: PAID)
      }
      ... on ExternalAppointmentVaccineProduct {
        vaccine {
          __typename
          type: __typename
          id
          name
        }
        patient {
          __typename
          type: __typename
          id
          name
          birthDate
          phoneNumber
        }
        shot {
          __typename
          type: __typename
          id
          date
          manufacturer {
            id
            name
          }
          dose {
            label
          }
          ... on ScheduledShot {
            reserved
            removable
          }
          ... on PendingShot {
            reserved
            removable
          }
          ... on AppliedShot {
            removable
          }
        }
      }
    }
    ... on ApprovedExternalAppointment {
      order {
        ...OrderFragment
      }
      paymentUrl
      expired
      refundable
      paid
    }
    ... on Appointment {
      spots {
        date
        schedule {
          time
          available
        }
      }
    }
  }
  ${orderFragment}
`;

const internalAppointmentFragment = gql`
  fragment InternalAppointmentFragment on InternalAppointment {
    paid
    observations
    shots {
      __typename
      type: __typename
      id
      date
      patient {
        id
        name
        birthDate
        phoneNumber
        address {
          address
          number
          complement
          district
          city
          state
        }
      }
      vaccine {
        id
        name
        manufacturers {
          id
          name
        }
      }
      dose {
        label
      }
      paid
      removable
      ... on InternalVaccineShot {
        manufacturer {
          id
          name
        }
      }
      ... on ScheduledShot {
        manufacturer {
          id
          name
        }
        reserved
      }
    }
  }
`;

export const fullAppointmentFragment = gql`
  fragment FullAppointmentFragment on Appointment {
    __typename
    type: __typename
    ...AppointmentFragment
    ...InternalAppointmentFragment
    ...ExternalAppointmentFragment
  }
  ${appointmentFragment}
  ${internalAppointmentFragment}
  ${externalAppointmentFragment}
`;

const appointmentBlockFragment = gql`
  fragment AppointmentBlockFragment on AppointmentBlock {
    __typename
    type: __typename
    id
    clinic {
      id
      name
    }
    date
    service
    time
    recurrent
    comment
  }
`;

const unavailableInInventoryErrorFragment = gql`
  fragment UnavailableInInventoryErrorFragment on UnavailableInInventoryError {
    __typename
    type: __typename
    field
  }
`;

const patientHistoryFragment = gql`
  fragment PatientHistoryFragment on PatientHistory {
    id
    date
    description
    patientId
    responsable
    attachments {
      name
      url
    }
  }
`;

export const appliersQuery = gql`
  query Appliers($clinicId: ID) {
    appliers(clinicId: $clinicId) {
      ...ApplierFragment
    }
  }
  ${applierFragment}
`;

export const vaccineListQuery = gql`
  query VaccineListNoBatch(
    $patientId: ID!
    $clinicId: ID
    $inventoryDate: LocalDate!
    $withPrice: Boolean!
    $withPrices: Boolean!
    $withInventoryCount: Boolean!
    $withDiscounts: Boolean!
    $withFees: Boolean!
    $withDoses: Boolean!
    $withApplicationSites: Boolean!
    $withApplicationMethods: Boolean!
    $withManufacturers: Boolean!
    $withBatches: Boolean!
    $withSuggestions: Boolean!
    $withReservable: Boolean!
    $withoutInventoryBatches: Boolean!
    $withoutInventoryCountBatches: Boolean!
  ) {
    vaccines {
      ...VaccineFragment
    }
  }
  ${vaccineFragment}
`;

export const vaccineQuery = gql`
  query Vaccine(
    $vaccineId: ID!
    $patientId: ID!
    $clinicId: ID
    $inventoryDate: LocalDate!
    $withPrice: Boolean!
    $withPrices: Boolean!
    $withInventoryCount: Boolean!
    $withDiscounts: Boolean!
    $withFees: Boolean!
    $withDoses: Boolean!
    $withApplicationSites: Boolean!
    $withApplicationMethods: Boolean!
    $withManufacturers: Boolean!
    $withBatches: Boolean!
    $withSuggestions: Boolean!
    $withReservable: Boolean!
    $withoutInventoryBatches: Boolean!
    $withoutInventoryCountBatches: Boolean!
  ) {
    vaccine: node(id: $vaccineId) {
      ...VaccineFragment
    }
  }
  ${vaccineFragment}
`;

export const vaccineNoBatchQuery = gql`
  query VaccineNoBatch(
    $vaccineId: ID!
    $patientId: ID!
    $clinicId: ID
    $inventoryDate: LocalDate!
    $withPrice: Boolean!
    $withPrices: Boolean!
    $withInventoryCount: Boolean!
    $withDiscounts: Boolean!
    $withFees: Boolean!
    $withDoses: Boolean!
    $withApplicationSites: Boolean!
    $withApplicationMethods: Boolean!
    $withManufacturers: Boolean!
    $withBatches: Boolean!
    $withSuggestions: Boolean!
    $withReservable: Boolean!
    $withoutInventoryBatches: Boolean!
    $withoutInventoryCountBatches: Boolean!
  ) {
    vaccine: node(id: $vaccineId) {
      ...VaccineFragment
    }
  }
  ${vaccineFragment}
`;

export const shotQuery = gql`
  query Shot(
    $shotId: ID!
    $withVaccine: Boolean!
    $withManufacturer: Boolean!
    $withBatch: Boolean!
    $withDose: Boolean!
    $withPatient: Boolean!
    $withAppointmentApplier: Boolean!
  ) {
    shot: node(id: $shotId) {
      ...ShotFragment
    }
  }
  ${shotFragment}
`;

export const cityAutocompleteQuery = gql`
  query CityAutocomplete($name: String!) {
    cities(name: $name, take: 10) {
      id
      name
      state
    }
  }
`;

const healthInsuranceFragment = gql`
  fragment HealthInsuranceFragment on HealthInsurance {
    id
    name
  }
`;

export const healthInsurancesQuery = gql`
  query HealthInsurances {
    healthInsurances {
      ...HealthInsuranceFragment
    }
  }
  ${healthInsuranceFragment}
`;

const referrerFragment = gql`
  fragment ReferrerFragment on Referrer {
    id
    name
  }
`;

export const referrerAutocompleteQuery = gql`
  query ReferrerAutocomplete($name: String) {
    referrers(name: $name, take: 8) {
      id
      name
    }
  }
`;

const fullPatientProfileFragment = gql`
  fragment FullPatientProfileFragment on Patient {
    name
    sex
    birthDate
    birthPlace {
      id
      name
    }
    birthCountry
    motherName
    fatherName
    cpf
    rg
    cns
    active
    address {
      address
      number
      complement
      district
      city
      cityCode
      state
      zipCode
    }
    mobile
    phones
    email
    allowEmailNotificationsForNonImmunizedDiseases
    allowEmailNotificationsForCampaigns
    allowWhatsappNotifications
    healthInsurance {
      ...HealthInsuranceFragment
    }
    healthInsuranceCode
    referrer {
      ...ReferrerFragment
    }
    contractedDiseases {
      name
    }
    notes
  }
  ${healthInsuranceFragment}
  ${referrerFragment}
`;

export const patientFragment = gql`
  fragment PatientFragment on Patient {
    id
    name
    sex
    birthDate
    active
    age {
      description(format: SIMPLE)
    }
    profileCompleted
    ...FullPatientProfileFragment @include(if: $withFullProfile)
    shots @include(if: $withShots) {
      __typename
      type: __typename
      id
      date
      dose {
        ...DoseFragment
      }
      observations
      vaccine {
        id
        name
        rule {
          id
          name
        }
      }
      batch
      removable
      migrated
      patientAge {
        description(format: FULL)
      }
      ... on InternalVaccineShot {
        patientSituation
        patientAttendanceGroupCode
        applier {
          ...ApplierFragment
        }
        homeService
        vaccineBundle {
          id
          name
        }
        appointment {
          __typename
          type: __typename
          id
          source
          editable
          time
          ... on ExternalAppointment {
            products {
              id
            }
          }
        }
      }
      ... on ExternalShot {
        adverseReactions {
          date
          description
        }
      }
      ... on Payable {
        paid: isPaymentStatus(status: PAID)
        paying: isPaymentStatus(status: PAYING)
        processing: isPaymentStatus(status: PROCESSING)
        payable
        refundable
        chargedPrice
      }
      ... on AppliedShot {
        manufacturer {
          id
          name
        }
        debitedFromInventory
        adverseReactions {
          date
          description
        }
        applicationSite {
          label
        }
      }
      ... on PendingShot {
        manufacturer {
          id
          name
        }
        reserved
        queue {
          id
          name
        }
        applicationSite {
          label
        }
        fullPriceWithPreviousShots
      }
      ... on ScheduledShot {
        manufacturer {
          id
          name
        }
        reserved
        orderItem {
          id
        }
        order {
          id
        }
        fullPriceWithPreviousShots
      }
      ... on SuggestedShot {
        forPregnant
      }
    }
    nonImmunizedDiseases @include(if: $withNonImmunizedDiseases) {
      name
    }
  }
  ${applierFragment}
  ${fullPatientProfileFragment}
  ${doseFragment}
`;

export const patientQuery = gql`
  query Patient(
    $id: ID!
    $withShots: Boolean = false
    $withNonImmunizedDiseases: Boolean = false
    $withFullProfile: Boolean = false
  ) {
    patient: node(id: $id) {
      ...PatientFragment
    }
  }
  ${patientFragment}
`;

export const campaignQuery = gql`
  query Campaign($id: ID!) {
    campaign: node(id: $id) {
      ...CampaignFragment
    }
  }
  ${campaignFragment}
`;

export const campaignShareQuery = gql`
  query CampaignShare($campaignId: ID, $code: String) {
    campaignShare(campaignId: $campaignId, code: $code) {
      ...CampaignShareFragment
    }
  }
  ${campaignShareFragment}
`;

export const campaignShotsListQuery = gql`
  query CampaignShotsList($campaignId: ID!, $filters: CampaignShotsFilters) {
    campaignShots(campaignId: $campaignId, filters: $filters) {
      ...CampaignShotFragment
    }
  }
  ${campaignShotFragment}
`;

export const paginatedCampaignShotsListQuery = gql`
  query PaginatedCampaignShotsList(
    $campaignId: ID!
    $filters: CampaignShotsFilters
    $page: Int = 1
    $pageSize: Int = 12
  ) {
    campaignShots: paginatedCampaignShots(
      campaignId: $campaignId
      filters: $filters
      page: $page
      pageSize: $pageSize
    ) {
      pageInfo {
        ...PageInfoFragment
      }
      items {
        ...CampaignShotFragment
      }
    }
  }
  ${campaignShotFragment}
  ${pageInfoFragment}
`;

export const upsertCampaignShareMutation = gql`
  mutation UpsertCampaignShare($input: UpsertCampaignShareInput!) {
    result: upsertCampaignShare(input: $input) {
      __typename
      type: __typename
      ...ValidationErrorsFragment
      ...CampaignShareFragment
    }
  }
  ${campaignShareFragment}
  ${validationErrorsFragment}
`;

export const upsertPatientMutation = gql`
  mutation UpsertPatient(
    $input: UpsertPatientInput!
    $withShots: Boolean = false
    $withNonImmunizedDiseases: Boolean = false
    $withFullProfile: Boolean = true
  ) {
    result: upsertPatient(input: $input) {
      __typename
      type: __typename
      ...ValidationErrorsFragment
      ...PatientFragment
    }
  }
  ${patientFragment}
  ${validationErrorsFragment}
`;

export const upsertPatientHistoryMutation = gql`
  mutation UpsertPatientHistory($input: UpsertPatientHistoryInput!) {
    result: upsertPatientHistory(input: $input) {
      __typename
      ...PatientHistoryFragment
    }
  }
  ${patientHistoryFragment}
`;

export const diseasesQuery = gql`
  query DiseasesQuery {
    diseases {
      name
    }
  }
`;

export const vaccineRulesQuery = gql`
  query VaccineRulesQuery($onlyUsedRules: Boolean!) {
    vaccineRules(onlyUsedRules: $onlyUsedRules) {
      type: __typename
      ... on VaccineRule {
        id
        name
        susOnly
      }
      ... on VaccineGroup {
        id
        name
        rules {
          type: __typename
          id
          name
          susOnly
        }
      }
    }
  }
`;

export const completeOrderMutation = gql`
  mutation CompleteOrderMutation($input: CompleteOrderInput!) {
    result: completeOrder(input: $input) {
      __typename
      type: __typename
      ...ValidationErrorsFragment
      ...OrderFragment
      ... on PaidOrder {
        externalAppointment {
          id
        }
      }
    }
  }
  ${orderFragment}
  ${validationErrorsFragment}
`;

export const addExternalShotMutation = gql`
  mutation AddExternalShotMutation($input: CreateExternalShotInput!) {
    result: createExternalShot(input: $input) {
      __typename
      type: __typename
      ...ValidationErrorsFragment
      ... on ExternalShot {
        id
        patient {
          id
        }
        dose {
          ...DoseFragment
          shot {
            type: __typename
            id
          }
        }
      }
    }
  }
  ${validationErrorsFragment}
  ${doseFragment}
`;

export const updateExternalShotMutation = gql`
  mutation UpdateExternalShotMutation($input: UpdateExternalShotInput!) {
    result: updateExternalShot(input: $input) {
      __typename
      type: __typename
      ...ValidationErrorsFragment
      ... on ExternalShot {
        id
        patient {
          id
        }
      }
    }
  }
  ${validationErrorsFragment}
`;

export const removeShotMutation = gql`
  mutation RemoveShotMutation($input: RemoveShotInput!) {
    result: removeShot(input: $input) {
      __typename
      type: __typename
      ... on ValidationError {
        error
      }
      ... on RemovedShot {
        shot {
          __typename
          type: __typename
          id
          patient {
            id
          }
          ... on InternalVaccineShot {
            vaccine {
              id
            }
          }
          ... on PendingShot {
            order {
              id
            }
          }
          ... on ScheduledShot {
            order {
              id
            }
          }
          ... on AppliedShot {
            order {
              id
            }
          }
        }
      }
    }
  }
`;

export const removeReserveFromShotMutation = gql`
  mutation RemoveReserveFromShotMutation($input: RemoveReserveFromShotInput!) {
    result: removeReserveFromShot(input: $input) {
      __typename
      type: __typename
      ... on ValidationError {
        error
      }
      ... on ScheduledShot {
        id
        vaccine {
          id
        }
        reserved
      }
      ... on PendingShot {
        id
        vaccine {
          id
        }
        reserved
      }
    }
  }
`;

export const addReserveToShotMutation = gql`
  mutation AddReserveToShotMutation($input: AddReserveToShotInput!) {
    result: addReserveToShot(input: $input) {
      __typename
      type: __typename
      ... on ValidationError {
        error
      }
      ... on ScheduledShot {
        id
        vaccine {
          id
        }
        reserved
      }
      ... on PendingShot {
        id
        vaccine {
          id
        }
        reserved
      }
      ... on UnavailableInInventoryForReservationError {
        message
      }
    }
  }
`;

export const addRetroactiveShotMutation = gql`
  mutation AddRetroactiveShotMutation($input: CreateRetroactiveShotInput!) {
    result: createRetroactiveShot(input: $input) {
      __typename
      type: __typename
      ...ValidationErrorsFragment
      ...UnavailableInInventoryErrorFragment
      ... on AppliedShot {
        id
        date
        patient {
          id
        }
        vaccine {
          id
        }
        debitedFromInventory
      }
      ... on ScheduledShot {
        id
        patient {
          id
        }
        vaccine {
          id
        }
        reserved
      }
    }
  }
  ${validationErrorsFragment}
  ${unavailableInInventoryErrorFragment}
`;

export const createAppliedShotsMutation = gql`
  mutation CreateAppliedShotsMutation($input: CreateAppliedShotsInput!) {
    result: createAppliedShots(input: $input) {
      order {
        __typename
        type: __typename
        ...ValidationErrorsFragment
        ...OrderFragment
        ... on Order {
          clinic {
            id
            name
          }
        }
      }
      shots {
        __typename
        type: __typename
        ...ValidationErrorsFragment
        ... on AppliedShot {
          id
          date
          patient {
            id
          }
          vaccine {
            id
          }
        }
      }
    }
  }
  ${orderFragment}
  ${validationErrorsFragment}
`;

export const applyPendingShotMutation = gql`
  mutation ApplyPendingShot($input: ApplyPendingShotInput!) {
    result: applyPendingShot(input: $input) {
      __typename
      type: __typename
      ...ValidationErrorsFragment
      ... on AppliedShot {
        id
        date
        vaccine {
          __typename
          id
        }
        manufacturer {
          id
        }
        patient {
          id
        }
      }
      ... on InvalidSecurityCodeError {
        message
      }
    }
  }
  ${validationErrorsFragment}
`;

export const upsertUnappliedShotMutation = gql`
  mutation UpsertUnappliedShot($input: UpsertUnappliedShotInput!) {
    result: upsertUnappliedShot(input: $input) {
      __typename
      type: __typename
      ...ValidationErrorsFragment
      ...UnavailableInInventoryErrorFragment
      ... on InternalVaccineShot {
        id
        date
        patient {
          id
        }
        vaccine {
          id
        }
        manufacturer {
          id
        }
        ... on PendingShot {
          queue {
            id
            name
          }
          applier {
            id
            name
          }
        }
      }
    }
  }
  ${validationErrorsFragment}
  ${unavailableInInventoryErrorFragment}
`;

export const updateAppliedShotMutation = gql`
  mutation UpdateAppliedShot($input: UpdateAppliedShotInput!) {
    result: updateAppliedShot(input: $input) {
      __typename
      type: __typename
      ...ValidationErrorsFragment
      ... on InternalVaccineShot {
        id
        date
        patient {
          id
        }
        vaccine {
          id
        }
        manufacturer {
          id
        }
      }
      ... on ShotNotFoundError {
        error
      }
      ... on ShotNotAppliedError {
        error
      }
    }
  }
  ${validationErrorsFragment}
`;

export const pendingPaymentsQuery = gql`
  query PendingPayments {
    pendingPayments {
      __typename
      type: __typename
      chargedPrice
      payableType
      patient {
        id
        name
        age {
          description(format: SIMPLE)
        }
      }
      ... on VaccineShot {
        id
        date
        vaccine {
          id
          name
        }
        dose {
          ...DoseFragment
        }
        ... on PendingShot {
          queue {
            id
            name
          }
        }
      }
      ... on NotPaidOrder {
        ...OrderFragment
      }
    }
  }
  ${orderFragment}
  ${doseFragment}
`;

export const paymentMethodsQuery = gql`
  query PaymentMethods($clinicId: ID) {
    result: paymentMethods(clinicId: $clinicId) {
      type: __typename
      id
      label
      maxInstallments
      selectable
    }
  }
`;

export const currentUserQuery = gql`
  query CurrentUser {
    result: currentUser {
      __typename
      type: __typename
      ... on InternalUser {
        id
        name
        coren
        suggestedClinic {
          id
          name
          logo {
            url
          }
        }
      }
    }
  }
`;

const vaccinePermissionsFragment = gql`
  fragment VaccinePermissionsFragment on Permission {
    canWriteVaccineName
    canWriteVaccineRule
    canWriteVaccinePrice
    canWriteVaccineActive
    canWriteVaccineSipniSync
    canWriteVaccineManufacturer
    canWriteVaccineManufacturerBarcode
    canWriteVaccineMinimumInInventory
    canWriteVaccineReplenishmentDays
    canWriteVaccineNextReplenishmentDate
    canWriteVaccineNcm
    canWriteVaccineCest
    canWriteVaccineGtin
    canWriteVaccineCstPis
    canWriteVaccineCstCofins
    canWriteVaccineIcmsOrigem
    canWriteVaccineClinicPrice
    canWriteVaccineClinicMinimumInInventory
    canWriteVaccineClinicReplenishmentDays
    canWriteVaccineClinicNextReplenishmentDate
  }
`;

export const currentUserPermissionsQuery = gql`
  query CurrentUserPermissions(
    $patientId: ID!
    $clinicId: ID
    $withPatientPermissions: Boolean!
    $withVaccinePermissions: Boolean = false
  ) {
    result: currentUser {
      __typename
      type: __typename
      ... on InternalUser {
        id
        permissions(clinicId: $clinicId) {
          canApplyShotBeforePayment
          canApplyShotWithoutBarcode
          canEditAppliedShot
          canCreateRetroactiveShot(withInventory: true)
          canCreateRetroactiveShotWithoutInventory: canCreateRetroactiveShot(withInventory: false)
          minRetroactiveShotDate(withInventory: true)
          minRetroactiveShotWithoutInventoryDate: minRetroactiveShotDate(withInventory: false)
          canGenerateInvoice
          permittedInvoiceTypes
          canViewPatient(patientId: $patientId) @include(if: $withPatientPermissions)
          canRemoveVaccineOnAppointment
          canViewSuggestions
          canSendBulkWhatsappMessages
          canEditPatientSensitiveData
          canRegisterBillingCreditCard
          canRegisterExpenses
          canAddCardBrand
          canManageVaccineBundles
          ...VaccinePermissionsFragment @include(if: $withVaccinePermissions)
        }
      }
      ... on PatientUser {
        patient {
          id
        }
        permissions(clinicId: $clinicId) {
          canViewPatient(patientId: $patientId) @include(if: $withPatientPermissions)
          canViewSuggestions
        }
      }
      ... on AnonymousUser {
        permissions(clinicId: $clinicId) {
          canViewPatient(patientId: $patientId) @include(if: $withPatientPermissions)
        }
      }
    }
  }
  ${vaccinePermissionsFragment}
`;

export const searchAddressByZipCodeQuery = gql`
  query SearchAddressByZipCode($vaccineId: Int!) {
    zipCodeSearch: searchAddressByZipCode(zipCode: $zipCode) @client {
      __typename
      type: __typename
      ... on InvalidZipCode {
        message
      }
      ... on Address {
        address
        complement
        district
        city
        cityCode
        state
        zipCode
      }
    }
  }
`;

export const generateInvoiceMutation = gql`
  mutation GenerateInvoice($input: GenerateInvoiceInput!) {
    result: generateInvoice(input: $input) {
      __typename
      type: __typename
      ...ValidationErrorsFragment
      ... on AlreadyGeneratedError {
        message
        items {
          ...InvoiceItemFragment
        }
      }
      ... on Invoice {
        id
        date
        status
        recipient {
          email
        }
        items {
          ...InvoiceItemFragment
        }
      }
    }
  }
  ${validationErrorsFragment}
  ${invoiceItemFragment}
`;

export const registerPublicPatientMutation = gql`
  mutation RegisterPublicPatient($input: RegisterPublicPatientInput!) {
    result: registerPublicPatient(input: $input) {
      __typename
      type: __typename
      ...ValidationErrorsFragment
      ... on PublicPatient {
        id
      }
    }
  }
  ${validationErrorsFragment}
`;

export const patientExistenceQuery = gql`
  query PatientExistence($name: String, $birthDate: Date, $cpf: CPF) {
    result: patientExistence(name: $name, birthDate: $birthDate, cpf: $cpf) {
      exists
    }
  }
`;

const queueFragment = gql`
  fragment QueueFragment on Queue {
    id
    name
    applier {
      __typename
      type: __typename
      id
    }
  }
`;

export const queuesQuery = gql`
  query Queues {
    result: queues {
      ...QueueFragment
    }
  }
  ${queueFragment}
`;

export const queuedShotsQuery = gql`
  query QueuedShots($startDate: LocalDate) {
    result: queuedShots(startDate: $startDate) {
      id
      date
      patient {
        id
        name
        age {
          description(format: SIMPLE)
        }
      }
      vaccine {
        id
        name
      }
      manufacturer {
        id
        name
      }
      dose {
        ...DoseFragment
      }
      queue {
        ...QueueFragment
      }
      homeService
      observations
    }
  }
  ${queueFragment}
  ${doseFragment}
`;

export const updateClinicMutation = gql`
  mutation UpdateClinicConfig($input: UpdateClinicConfigInput!) {
    result: updateClinicConfig(input: $input) {
      __typename
      type: __typename
      ...ValidationErrorsFragment
      ... on Clinic {
        id
        name
        cnes
        sipniCertificate {
          expirationDate
        }
        sipniApiConfig {
          ownerDocument
          apiId
        }
      }
    }
  }
  ${validationErrorsFragment}
`;

export const updateClinicVacinaEConfiaConfigMutation = gql`
  mutation UpdateClinicVacinaEConfiaConfig($input: UpdateClinicVacinaEConfiaConfigInput!) {
    result: updateClinicVacinaEConfiaConfig(input: $input) {
      __typename
      type: __typename
      ...ValidationErrorsFragment
      ... on VacinaEConfiaConfig {
        cnes
        unitId
        integrationCredentialsUsername
        integrationCredentialsPassword
      }
    }
  }
  ${validationErrorsFragment}
`;

export const clinicQuery = gql`
  query Clinic($id: ID!) {
    clinic: node(id: $id) {
      ... on Clinic {
        id
        name
        cnes
        sipniCertificate {
          expirationDate
        }
        sipniApiConfig {
          ownerDocument
          apiId
        }
        usesVacinaEConfia
        vacinaEConfiaConfig {
          cnes
          unitId
          integrationCredentialsUsername
          integrationCredentialsPassword
        }
      }
    }
  }
`;

export const clinicsQuery = gql`
  query Clinics {
    clinics {
      id
      name
    }
  }
`;

export const clinicSipniRiaEvidenceQuery = gql`
  query ClinicSipniRiaEvidence($id: ID!) {
    clinic: node(id: $id) {
      ... on Clinic {
        id
        sipniRiaEvidence {
          url
          status
          errorMessage
          timestamp
        }
      }
    }
  }
`;

export const appointmentListQuery = gql`
  query AppointmentList(
    $startDate: Date
    $endDate: Date
    $startCreatedAt: Date
    $endCreatedAt: Date
    $status: ExternalAppointmentStatus
    $notStatus: ExternalAppointmentStatus
    $service: AppointmentService
    $clientName: String
    $clientCpf: CPF
    $clientEmail: String
    $patientName: String
    $clinicId: ID
  ) {
    appointments(
      startDate: $startDate
      endDate: $endDate
      startCreatedAt: $startCreatedAt
      endCreatedAt: $endCreatedAt
      status: $status
      notStatus: $notStatus
      service: $service
      clientName: $clientName
      clientCpf: $clientCpf
      clientEmail: $clientEmail
      patientName: $patientName
      clinicId: $clinicId
    ) {
      ...AppointmentFragment
      ... on ApprovedExternalAppointment {
        paid
        paymentUrl
      }
      ... on ExternalAppointment {
        client {
          name
          cpf
          email
          phoneNumber
        }
      }
      ... on InternalAppointment {
        paid
      }
    }
  }
  ${appointmentFragment}
`;

export const paginatedExternalAppointmentListQuery = gql`
  query PaginatedExternalAppointmentList(
    $startDate: Date
    $endDate: Date
    $startCreatedAt: Date
    $endCreatedAt: Date
    $status: ExternalAppointmentStatus
    $notStatus: ExternalAppointmentStatus
    $service: AppointmentService
    $clientName: String
    $clientCpf: CPF
    $clientEmail: String
    $patientName: String
    $clinicId: ID
    $page: Int = 1
    $pageSize: Int = 40
  ) {
    appointments: paginatedExternalAppointments(
      startDate: $startDate
      endDate: $endDate
      startCreatedAt: $startCreatedAt
      endCreatedAt: $endCreatedAt
      status: $status
      notStatus: $notStatus
      service: $service
      clientName: $clientName
      clientCpf: $clientCpf
      clientEmail: $clientEmail
      patientName: $patientName
      clinicId: $clinicId
      page: $page
      pageSize: $pageSize
    ) {
      pageInfo {
        ...PageInfoFragment
      }
      items {
        ...AppointmentFragment
        ... on ApprovedExternalAppointment {
          paid
        }
        ... on ExternalAppointment {
          client {
            name
            cpf
            email
            phoneNumber
          }
        }
        ... on InternalAppointment {
          paid
        }
      }
    }
  }
  ${appointmentFragment}
  ${pageInfoFragment}
`;

export const appointmentQuery = gql`
  query AppointmentNoBatch($id: ID!) {
    appointment: node(id: $id) {
      ...FullAppointmentFragment
    }
  }
  ${fullAppointmentFragment}
`;

export const updateExternalAppointmentMutation = gql`
  mutation UpdateExternalAppointment($input: UpdateExternalAppointmentInput!) {
    result: updateExternalAppointment(input: $input) {
      __typename
      type: __typename
      ...ValidationErrorsFragment
      ...FullAppointmentFragment
    }
  }
  ${fullAppointmentFragment}
  ${validationErrorsFragment}
`;

export const upsertInternalAppointmentMutation = gql`
  mutation UpsertInternalAppointment($input: UpsertInternalAppointmentInput!) {
    result: upsertInternalAppointment(input: $input) {
      __typename
      type: __typename
      ...ValidationErrorsFragment
      ...UnavailableInInventoryErrorFragment
      ...FullAppointmentFragment
    }
  }
  ${fullAppointmentFragment}
  ${validationErrorsFragment}
  ${unavailableInInventoryErrorFragment}
`;

export const patientListQuery = gql`
  query PatientList(
    $withFullProfile: Boolean = false
    $withAge: Boolean = false
    $filters: PatientsFilters
    $take: Int
  ) {
    patients(take: $take, filters: $filters) {
      id
      name
      sex
      phones
      mobile
      profileCompleted
      ...FullPatientProfileFragment @include(if: $withFullProfile)
      age @include(if: $withAge) {
        description(format: SIMPLE)
      }
    }
  }
  ${fullPatientProfileFragment}
`;

export const externalAppointmentClientListQuery = gql`
  query AppointmentClientList($name: String!) {
    externalAppointmentClients(name: $name) {
      name
    }
  }
`;

export const removeAppointmentMutation = gql`
  mutation RemoveAppointmentMutation($input: RemoveAppointmentInput!) {
    result: removeAppointment(input: $input) {
      __typename
      type: __typename
      ... on ValidationError {
        error
      }
      ... on NotCancelledExternalAppointment {
        message
      }
      ... on RemovedAppointment {
        appointment {
          __typename
          type: __typename
          id
          ... on ExternalAppointment {
            products {
              ... on ExternalAppointmentVaccineProduct {
                shot {
                  vaccine {
                    id
                  }
                }
              }
            }
          }
          ... on InternalAppointment {
            shots {
              vaccine {
                id
              }
            }
          }
        }
      }
    }
  }
`;

export const appointmentBlockListQuery = gql`
  query AppointmentBlockQuery($startDate: Date, $endDate: Date) {
    appointmentBlocks(startDate: $startDate, endDate: $endDate) {
      ...AppointmentBlockFragment
    }
  }
  ${appointmentBlockFragment}
`;

export const appointmentBlockQuery = gql`
  query AppointmentBlock($id: ID!) {
    appointmentBlock: node(id: $id) {
      ...AppointmentBlockFragment
    }
  }
  ${appointmentBlockFragment}
`;

export const scheduledShotsWithoutAppointmentQuery = gql`
  query ScheduledShotsWithoutAppointmentQuery(
    $startDate: Date
    $endDate: Date
    $service: AppointmentService
  ) {
    scheduledShotsWithoutAppointment(startDate: $startDate, endDate: $endDate, service: $service) {
      __typename
      type: __typename
      id
      date
      patient {
        name
      }
      clinic {
        id
      }
      vaccine {
        id
        name
      }
      ... on ScheduledShot {
        homeService
      }
    }
  }
`;

export const createAppointmentBlockMutation = gql`
  mutation CreateAppointmentBlock($input: CreateAppointmentBlockInput!) {
    result: createAppointmentBlock(input: $input) {
      ...AppointmentBlockFragment
      ...ValidationErrorsFragment
    }
  }
  ${appointmentBlockFragment}
  ${validationErrorsFragment}
`;

export const updateAppointmentBlockMutation = gql`
  mutation UpdateAppointmentBlock($input: UpdateAppointmentBlockInput!) {
    result: updateAppointmentBlock(input: $input) {
      ...AppointmentBlockFragment
      ...ValidationErrorsFragment
    }
  }
  ${appointmentBlockFragment}
  ${validationErrorsFragment}
`;

export const removeAppointmentBlockMutation = gql`
  mutation RemoveAppointmentBlockMutation($input: RemoveAppointmentBlockInput!) {
    result: removeAppointmentBlock(input: $input) {
      appointmentBlock {
        ...AppointmentBlockFragment
      }
    }
  }
  ${appointmentBlockFragment}
`;

export const removePatientHistoryMutation = gql`
  mutation RemovePatientHistoryMutation($input: RemovePatientHistoryInput!) {
    removePatientHistory(input: $input) {
      success
      message
    }
  }
`;

export const clinicsSpotsQuery = gql`
  query ClinicsSpots($service: AppointmentService!, $dateRange: DateRange!) {
    result: clinics {
      id
      name
      attendingSpots(service: $service, dateRange: $dateRange) {
        date
        schedule {
          time
          available
          open
        }
      }
    }
  }
`;

export const updateUnpaidShotMutation = gql`
  mutation UpdateUnpaidShot($input: UpdateUnpaidShotInput!) {
    result: updateUnpaidShot(input: $input) {
      __typename
      type: __typename
      ...ValidationErrorsFragment
      ...UnavailableInInventoryErrorFragment
      ... on VaccineShot {
        id
        date
        vaccine {
          id
          name
        }
        batch
        ... on InternalVaccineShot {
          manufacturer {
            id
            name
          }
        }
        ... on PendingShot {
          reserved
        }
        ... on ScheduledShot {
          reserved
        }
        ... on Payable {
          chargedPrice
          paid: isPaymentStatus(status: PAID)
          paying: isPaymentStatus(status: PAYING)
          payable
        }
      }
    }
  }
  ${validationErrorsFragment}
  ${unavailableInInventoryErrorFragment}
`;

export const refundPayableMutation = gql`
  mutation RefundPayableMutation($input: RefundPayableInput!) {
    result: refundPayable(input: $input) {
      __typename
      type: __typename
      ... on ValidationError {
        error
      }
      ... on RefundedPayable {
        payable {
          __typename
          type: __typename
          paid: isPaymentStatus(status: PAID)
          paying: isPaymentStatus(status: PAYING)
          payable
          refundable
          chargedPrice
          ... on InternalVaccineShot {
            id
            appointment {
              __typename
              type: __typename
              id
            }
            ... on PendingShot {
              reserved
              removable
            }
            ... on ScheduledShot {
              removable
              reserved
              orderItem {
                id
              }
              order {
                id
              }
            }
            ... on AppliedShot {
              removable
            }
          }
          ... on ExternalAppointmentProduct {
            id
          }
        }
      }
    }
  }
`;

export const removeSuggestionMutation = gql`
  mutation RemoveSuggestionMutation($input: RemoveSuggestionInput!) {
    result: removeSuggestion(input: $input) {
      __typename
      type: __typename
      ... on ValidationError {
        error
      }
      ... on SuggestedShot {
        id
        patient {
          id
        }
      }
    }
  }
`;

export const moveShotsMutation = gql`
  mutation MoveShots($input: [MoveShotInput!]!) {
    results: moveShots(input: $input) {
      __typename
      type: __typename
      ...ValidationErrorsFragment
      ... on VaccineShot {
        id
        date
        patient {
          id
        }
      }
    }
  }
  ${validationErrorsFragment}
`;

export const patientAttendanceGroupsQuery = gql`
  query PatientAttendanceGroups {
    result: patientAttendanceGroups {
      code
      name
    }
  }
`;

export const patientHistoryListQuery = gql`
  query PatientHistory(
    $patientId: ID!
    $withShots: Boolean = true
    $withNonImmunizedDiseases: Boolean = false
    $withFullProfile: Boolean = false
  ) {
    patient: node(id: $patientId) {
      ...PatientFragment
    }
    patientHistories(patientId: $patientId) {
      ...PatientHistoryFragment
    }
    currentUser {
      __typename
      userType: __typename
      ... on InternalUser {
        name
      }
    }
  }
  ${patientFragment}
  ${patientHistoryFragment}
`;

export const userAccessesClinics = gql`
  query userAccessesClinics($id: ID!) {
    user(id: $id) {
      __typename
      ... on InternalUser {
        id
        name
        userAccesses {
          role
          clinic {
            id
          }
        }
      }
    }
  }
`;

export const currentChain = gql`
  query currentChain {
    currentChain {
      clinics {
        id
        name
      }
      roles {
        name
        value
      }
    }
  }
`;

export const updateUserClinicAccessMutation = gql`
  mutation UpdateUserClinicAccess($input: UpdateUserClinicAccessInput!) {
    result: updateUserClinicAccess(input: $input) {
      __typename
      type: __typename
      ...ValidationErrorsFragment
      ... on InternalUser {
        id
        name
      }
    }
  }
  ${validationErrorsFragment}
`;

export const PROCESS_BASE64_FILE_MUTATION = gql`
  mutation ProcessBase64File($input: ProcessBase64FileInput!) {
    processBase64File(input: $input) {
      payload {
        success
        geminiResponse
        errors
      }
    }
  }
`;

export const SAVE_EXTRACTED_VACCINE_APPLICATIONS_MUTATION = gql`
  mutation SaveExtractedVaccineApplications($input: SaveExtractedVaccineApplicationsInput!) {
    saveExtractedVaccineApplications(input: $input) {
      payload {
        overallSuccess
        processedApplications {
          inputIndex
          success
          shot {
            id
            # Add any other fields from ExternalShotType you might want to use later
            # date 
            # observations
            # batch
          }
          errors
        }
      }
    }
  }
`;
