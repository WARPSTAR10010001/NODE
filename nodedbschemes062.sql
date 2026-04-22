--
-- PostgreSQL database dump
--

\restrict jP5MiEcPkBvUZBc0tJumogbe9xKJaTrieDywjnNNfLgbgoaqAficgV82ab4OrPH

-- Dumped from database version 18.1
-- Dumped by pg_dump version 18.1

-- Started on 2026-04-21 16:01:21

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET transaction_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 222 (class 1259 OID 24626)
-- Name: categories; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.categories (
    id bigint NOT NULL,
    name text NOT NULL,
    description text DEFAULT ''::text
);


--
-- TOC entry 221 (class 1259 OID 24625)
-- Name: categories_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.categories_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5124 (class 0 OID 0)
-- Dependencies: 221
-- Name: categories_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.categories_id_seq OWNED BY public.categories.id;


--
-- TOC entry 230 (class 1259 OID 24679)
-- Name: depreciations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.depreciations (
    id bigint NOT NULL,
    "time" integer NOT NULL,
    scale text NOT NULL,
    CONSTRAINT depreciations_scale_check CHECK ((scale = ANY (ARRAY['months'::text, 'years'::text])))
);


--
-- TOC entry 229 (class 1259 OID 24678)
-- Name: depreciations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.depreciations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5125 (class 0 OID 0)
-- Dependencies: 229
-- Name: depreciations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.depreciations_id_seq OWNED BY public.depreciations.id;


--
-- TOC entry 236 (class 1259 OID 32771)
-- Name: device_logs; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.device_logs (
    id bigint NOT NULL,
    "deviceId" integer NOT NULL,
    "inventoryNumber" text NOT NULL,
    version integer NOT NULL,
    section text NOT NULL,
    changes jsonb NOT NULL,
    "changedBy" integer,
    "changedAt" timestamp with time zone DEFAULT now() NOT NULL
);


--
-- TOC entry 235 (class 1259 OID 32770)
-- Name: device_logs_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.device_logs_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5126 (class 0 OID 0)
-- Dependencies: 235
-- Name: device_logs_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.device_logs_id_seq OWNED BY public.device_logs.id;


--
-- TOC entry 232 (class 1259 OID 24692)
-- Name: devices; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.devices (
    id bigint NOT NULL,
    "inventoryNumber" text NOT NULL,
    name text NOT NULL,
    "categoryId" bigint NOT NULL,
    "statusId" bigint NOT NULL,
    purchase timestamp without time zone,
    price numeric(12,2),
    supplier text,
    "depreciationId" bigint,
    "accountingType" text DEFAULT 'konsumtiv'::text NOT NULL,
    "assignedToUserId" bigint,
    "locationId" bigint,
    "networkEnvironmentId" bigint,
    manufacturer text,
    model text,
    "serialNumber" text,
    "patchPanelLabel" text,
    "ipAddress" inet,
    "macAddresses" macaddr[],
    "leaseDurationMonths" integer,
    "contractType" text,
    notes text,
    "createdBy" bigint,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "lastEditBy" bigint,
    "lastEditAt" timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT devices_accounting_check CHECK (("accountingType" = ANY (ARRAY['konsumtiv'::text, 'investiv'::text]))),
    CONSTRAINT devices_contract_check CHECK ((("contractType" IS NULL) OR ("contractType" = ANY (ARRAY['purchase'::text, 'pay-per-page'::text, 'lease'::text]))))
);


--
-- TOC entry 231 (class 1259 OID 24691)
-- Name: devices_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.devices_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5127 (class 0 OID 0)
-- Dependencies: 231
-- Name: devices_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.devices_id_seq OWNED BY public.devices.id;


--
-- TOC entry 234 (class 1259 OID 24756)
-- Name: electronic_tests; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.electronic_tests (
    id bigint NOT NULL,
    "deviceId" bigint NOT NULL,
    tester text NOT NULL,
    "lastTest" timestamp without time zone NOT NULL,
    "lastTestResult" text NOT NULL,
    "nextTestPeriod" integer NOT NULL,
    scale text NOT NULL,
    "createdBy" bigint,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "lastEditBy" bigint,
    "lastEditAt" timestamp without time zone DEFAULT now() NOT NULL,
    CONSTRAINT "electronic_tests_lastTestResult_check" CHECK (("lastTestResult" = ANY (ARRAY['pass'::text, 'fail'::text]))),
    CONSTRAINT electronic_tests_scale_check CHECK ((scale = ANY (ARRAY['months'::text, 'years'::text])))
);


--
-- TOC entry 233 (class 1259 OID 24755)
-- Name: electronic_tests_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.electronic_tests_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5128 (class 0 OID 0)
-- Dependencies: 233
-- Name: electronic_tests_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.electronic_tests_id_seq OWNED BY public.electronic_tests.id;


--
-- TOC entry 226 (class 1259 OID 24654)
-- Name: locations; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.locations (
    id bigint NOT NULL,
    city text NOT NULL,
    address text NOT NULL,
    "houseNumber" text,
    room text
);


--
-- TOC entry 225 (class 1259 OID 24653)
-- Name: locations_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.locations_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5129 (class 0 OID 0)
-- Dependencies: 225
-- Name: locations_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.locations_id_seq OWNED BY public.locations.id;


--
-- TOC entry 228 (class 1259 OID 24666)
-- Name: network_environments; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.network_environments (
    id bigint NOT NULL,
    name text NOT NULL
);


--
-- TOC entry 227 (class 1259 OID 24665)
-- Name: network_environments_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.network_environments_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5130 (class 0 OID 0)
-- Dependencies: 227
-- Name: network_environments_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.network_environments_id_seq OWNED BY public.network_environments.id;


--
-- TOC entry 224 (class 1259 OID 24640)
-- Name: statuses; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.statuses (
    id bigint NOT NULL,
    name text NOT NULL,
    description text DEFAULT ''::text
);


--
-- TOC entry 223 (class 1259 OID 24639)
-- Name: statuses_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.statuses_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5131 (class 0 OID 0)
-- Dependencies: 223
-- Name: statuses_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.statuses_id_seq OWNED BY public.statuses.id;


--
-- TOC entry 220 (class 1259 OID 24601)
-- Name: users; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public.users (
    id bigint NOT NULL,
    "adGuid" text NOT NULL,
    username text NOT NULL,
    role integer DEFAULT 0 NOT NULL,
    "createdAt" timestamp without time zone DEFAULT now() NOT NULL,
    "lastLogin" timestamp without time zone DEFAULT now() NOT NULL,
    "isActivated" boolean DEFAULT false NOT NULL,
    "previouslyLoggedIn" boolean DEFAULT false NOT NULL,
    CONSTRAINT users_role_check CHECK ((role = ANY (ARRAY[0, 1, 2])))
);


--
-- TOC entry 219 (class 1259 OID 24600)
-- Name: users_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public.users_id_seq
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 5132 (class 0 OID 0)
-- Dependencies: 219
-- Name: users_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public.users_id_seq OWNED BY public.users.id;


--
-- TOC entry 4902 (class 2604 OID 24629)
-- Name: categories id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories ALTER COLUMN id SET DEFAULT nextval('public.categories_id_seq'::regclass);


--
-- TOC entry 4908 (class 2604 OID 24682)
-- Name: depreciations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.depreciations ALTER COLUMN id SET DEFAULT nextval('public.depreciations_id_seq'::regclass);


--
-- TOC entry 4916 (class 2604 OID 32774)
-- Name: device_logs id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_logs ALTER COLUMN id SET DEFAULT nextval('public.device_logs_id_seq'::regclass);


--
-- TOC entry 4909 (class 2604 OID 24695)
-- Name: devices id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devices ALTER COLUMN id SET DEFAULT nextval('public.devices_id_seq'::regclass);


--
-- TOC entry 4913 (class 2604 OID 24759)
-- Name: electronic_tests id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.electronic_tests ALTER COLUMN id SET DEFAULT nextval('public.electronic_tests_id_seq'::regclass);


--
-- TOC entry 4906 (class 2604 OID 24657)
-- Name: locations id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations ALTER COLUMN id SET DEFAULT nextval('public.locations_id_seq'::regclass);


--
-- TOC entry 4907 (class 2604 OID 24669)
-- Name: network_environments id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.network_environments ALTER COLUMN id SET DEFAULT nextval('public.network_environments_id_seq'::regclass);


--
-- TOC entry 4904 (class 2604 OID 24643)
-- Name: statuses id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.statuses ALTER COLUMN id SET DEFAULT nextval('public.statuses_id_seq'::regclass);


--
-- TOC entry 4896 (class 2604 OID 24604)
-- Name: users id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users ALTER COLUMN id SET DEFAULT nextval('public.users_id_seq'::regclass);


--
-- TOC entry 4931 (class 2606 OID 24638)
-- Name: categories categories_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_name_key UNIQUE (name);


--
-- TOC entry 4933 (class 2606 OID 24636)
-- Name: categories categories_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.categories
    ADD CONSTRAINT categories_pkey PRIMARY KEY (id);


--
-- TOC entry 4945 (class 2606 OID 24690)
-- Name: depreciations depreciations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.depreciations
    ADD CONSTRAINT depreciations_pkey PRIMARY KEY (id);


--
-- TOC entry 4958 (class 2606 OID 32786)
-- Name: device_logs device_logs_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_logs
    ADD CONSTRAINT device_logs_pkey PRIMARY KEY (id);


--
-- TOC entry 4947 (class 2606 OID 24714)
-- Name: devices devices_inventoryNumber_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT "devices_inventoryNumber_key" UNIQUE ("inventoryNumber");


--
-- TOC entry 4949 (class 2606 OID 24712)
-- Name: devices devices_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT devices_pkey PRIMARY KEY (id);


--
-- TOC entry 4951 (class 2606 OID 24776)
-- Name: electronic_tests electronic_tests_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.electronic_tests
    ADD CONSTRAINT electronic_tests_pkey PRIMARY KEY (id);


--
-- TOC entry 4939 (class 2606 OID 24664)
-- Name: locations locations_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.locations
    ADD CONSTRAINT locations_pkey PRIMARY KEY (id);


--
-- TOC entry 4941 (class 2606 OID 24677)
-- Name: network_environments network_environments_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.network_environments
    ADD CONSTRAINT network_environments_name_key UNIQUE (name);


--
-- TOC entry 4943 (class 2606 OID 24675)
-- Name: network_environments network_environments_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.network_environments
    ADD CONSTRAINT network_environments_pkey PRIMARY KEY (id);


--
-- TOC entry 4935 (class 2606 OID 24652)
-- Name: statuses statuses_name_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.statuses
    ADD CONSTRAINT statuses_name_key UNIQUE (name);


--
-- TOC entry 4937 (class 2606 OID 24650)
-- Name: statuses statuses_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.statuses
    ADD CONSTRAINT statuses_pkey PRIMARY KEY (id);


--
-- TOC entry 4925 (class 2606 OID 24622)
-- Name: users users_adGuid_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT "users_adGuid_key" UNIQUE ("adGuid");


--
-- TOC entry 4927 (class 2606 OID 24620)
-- Name: users users_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_pkey PRIMARY KEY (id);


--
-- TOC entry 4929 (class 2606 OID 24624)
-- Name: users users_username_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.users
    ADD CONSTRAINT users_username_key UNIQUE (username);


--
-- TOC entry 4954 (class 1259 OID 32799)
-- Name: device_logs_changed_at_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX device_logs_changed_at_idx ON public.device_logs USING btree ("changedAt" DESC);


--
-- TOC entry 4955 (class 1259 OID 32797)
-- Name: device_logs_device_version_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE UNIQUE INDEX device_logs_device_version_idx ON public.device_logs USING btree ("deviceId", version);


--
-- TOC entry 4956 (class 1259 OID 32798)
-- Name: device_logs_inventory_number_idx; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX device_logs_inventory_number_idx ON public.device_logs USING btree ("inventoryNumber");


--
-- TOC entry 4952 (class 1259 OID 24792)
-- Name: idx_et_device; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_et_device ON public.electronic_tests USING btree ("deviceId");


--
-- TOC entry 4953 (class 1259 OID 24793)
-- Name: idx_et_lasttest; Type: INDEX; Schema: public; Owner: -
--

CREATE INDEX idx_et_lasttest ON public.electronic_tests USING btree ("lastTest");


--
-- TOC entry 4970 (class 2606 OID 32792)
-- Name: device_logs device_logs_changedBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_logs
    ADD CONSTRAINT "device_logs_changedBy_fkey" FOREIGN KEY ("changedBy") REFERENCES public.users(id) ON DELETE SET NULL;


--
-- TOC entry 4971 (class 2606 OID 32787)
-- Name: device_logs device_logs_deviceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.device_logs
    ADD CONSTRAINT "device_logs_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES public.devices(id) ON DELETE CASCADE;


--
-- TOC entry 4959 (class 2606 OID 24730)
-- Name: devices devices_assignedToUserId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT "devices_assignedToUserId_fkey" FOREIGN KEY ("assignedToUserId") REFERENCES public.users(id);


--
-- TOC entry 4960 (class 2606 OID 24715)
-- Name: devices devices_categoryId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT "devices_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES public.categories(id);


--
-- TOC entry 4961 (class 2606 OID 24745)
-- Name: devices devices_createdBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT "devices_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES public.users(id);


--
-- TOC entry 4962 (class 2606 OID 24725)
-- Name: devices devices_depreciationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT "devices_depreciationId_fkey" FOREIGN KEY ("depreciationId") REFERENCES public.depreciations(id);


--
-- TOC entry 4963 (class 2606 OID 24750)
-- Name: devices devices_lastEditBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT "devices_lastEditBy_fkey" FOREIGN KEY ("lastEditBy") REFERENCES public.users(id);


--
-- TOC entry 4964 (class 2606 OID 24735)
-- Name: devices devices_locationId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT "devices_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES public.locations(id);


--
-- TOC entry 4965 (class 2606 OID 24740)
-- Name: devices devices_networkEnvironmentId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT "devices_networkEnvironmentId_fkey" FOREIGN KEY ("networkEnvironmentId") REFERENCES public.network_environments(id);


--
-- TOC entry 4966 (class 2606 OID 24720)
-- Name: devices devices_statusId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.devices
    ADD CONSTRAINT "devices_statusId_fkey" FOREIGN KEY ("statusId") REFERENCES public.statuses(id);


--
-- TOC entry 4967 (class 2606 OID 24782)
-- Name: electronic_tests electronic_tests_createdBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.electronic_tests
    ADD CONSTRAINT "electronic_tests_createdBy_fkey" FOREIGN KEY ("createdBy") REFERENCES public.users(id);


--
-- TOC entry 4968 (class 2606 OID 24777)
-- Name: electronic_tests electronic_tests_deviceId_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.electronic_tests
    ADD CONSTRAINT "electronic_tests_deviceId_fkey" FOREIGN KEY ("deviceId") REFERENCES public.devices(id) ON DELETE CASCADE;


--
-- TOC entry 4969 (class 2606 OID 24787)
-- Name: electronic_tests electronic_tests_lastEditBy_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public.electronic_tests
    ADD CONSTRAINT "electronic_tests_lastEditBy_fkey" FOREIGN KEY ("lastEditBy") REFERENCES public.users(id);


-- Completed on 2026-04-21 16:01:22

--
-- PostgreSQL database dump complete
--

\unrestrict jP5MiEcPkBvUZBc0tJumogbe9xKJaTrieDywjnNNfLgbgoaqAficgV82ab4OrPH

