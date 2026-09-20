-- O contrato estabelece 100 convidados como mínimo financeiro, não como teto.
-- Convites e confirmações podem ultrapassar esse número; o excedente é apenas informativo.
DROP TRIGGER IF EXISTS invitation_event_capacity ON invitations;
DROP FUNCTION IF EXISTS enforce_event_capacity();
